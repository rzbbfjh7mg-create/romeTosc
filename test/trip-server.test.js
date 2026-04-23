import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTripServer, createTripStore } from "../src/trip-server.js";

async function withTripServer(run, { dataFilePath } = {}) {
  const store = createTripStore({
    persist: true,
    dataFilePath
  });
  const htmlFilePath = join(process.cwd(), "רומא_טוסקנה_2026.html");
  const server = createTripServer(store, { htmlFilePath });

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test("trip API returns persisted itinerary data", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "trip-server-"));
  const dataFilePath = join(tempDir, "roma-toscana-2026.json");

  try {
    await withTripServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trip-data`);
      assert.equal(response.status, 200);

      const payload = await response.json();
      assert.equal(Array.isArray(payload.days), true);
      assert.equal(payload.days.length, 9);
      assert.equal(payload.days[0].date, "30 באפריל");
      assert.equal(payload.days[0].day, "יום חמישי");
    }, { dataFilePath });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("trip API writes updates to the JSON file", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "trip-server-"));
  const dataFilePath = join(tempDir, "roma-toscana-2026.json");

  try {
    await withTripServer(async (baseUrl) => {
      const initialResponse = await fetch(`${baseUrl}/api/trip-data`);
      const initialPayload = await initialResponse.json();
      initialPayload.days[0].acts.push({
        ico: "🍝",
        txt: "ארוחת ערב שנשמרה לקובץ",
        type: "food",
        time: "20:00"
      });

      const saveResponse = await fetch(`${baseUrl}/api/trip-data`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(initialPayload)
      });

      assert.equal(saveResponse.status, 200);

      const savedRaw = await readFile(dataFilePath, "utf8");
      const savedPayload = JSON.parse(savedRaw);
      assert.equal(savedPayload.days[0].acts.at(-1).txt, "ארוחת ערב שנשמרה לקובץ");
    }, { dataFilePath });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("trip server serves the itinerary HTML", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "trip-server-"));
  const dataFilePath = join(tempDir, "roma-toscana-2026.json");

  try {
    await withTripServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/html/i);

      const html = await response.text();
      assert.match(html, /רומא וטוסקנה/);
    }, { dataFilePath });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
