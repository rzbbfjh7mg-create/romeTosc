import { createServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = normalize(join(__dirname, ".."));
const bundledSeedFilePath = join(projectRoot, "data", "roma-toscana-2026.json");

class TripError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "TripError";
    this.statusCode = statusCode;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveTripHtmlPath() {
  return process.env.TRIP_HTML_FILE ?? join(projectRoot, "רומא_טוסקנה_2026.html");
}

function resolveTripDataPath() {
  return process.env.TRIP_DATA_FILE ?? join(projectRoot, "data", "roma-toscana-2026.json");
}

function normalizeActivity(activity) {
  if (!activity || typeof activity !== "object") {
    throw new TripError("מבנה אטרקציה לא תקין");
  }

  if (typeof activity.txt !== "string" || activity.txt.trim().length < 1) {
    throw new TripError("כל אטרקציה חייבת לכלול שם");
  }

  if (typeof activity.type !== "string" || activity.type.trim().length < 1) {
    throw new TripError("כל אטרקציה חייבת לכלול סיווג");
  }

  const normalized = {
    ico: typeof activity.ico === "string" && activity.ico.trim() ? activity.ico.trim() : "📍",
    txt: activity.txt.trim(),
    type: activity.type.trim()
  };

  if (typeof activity.note === "string" && activity.note.trim()) {
    normalized.note = activity.note.trim();
  }

  if (typeof activity.time === "string" && activity.time.trim()) {
    normalized.time = activity.time.trim();
  }

  return normalized;
}

function normalizeDay(day) {
  if (!day || typeof day !== "object") {
    throw new TripError("מבנה יום לא תקין");
  }

  if (typeof day.date !== "string" || !day.date.trim()) {
    throw new TripError("כל יום חייב לכלול תאריך");
  }

  if (typeof day.day !== "string" || !day.day.trim()) {
    throw new TripError("כל יום חייב לכלול יום בשבוע");
  }

  if (typeof day.loc !== "string" || !day.loc.trim()) {
    throw new TripError("כל יום חייב לכלול מיקום");
  }

  if (typeof day.region !== "string" || !day.region.trim()) {
    throw new TripError("כל יום חייב לכלול אזור");
  }

  if (!Array.isArray(day.acts)) {
    throw new TripError("כל יום חייב לכלול רשימת אטרקציות");
  }

  return {
    date: day.date.trim(),
    day: day.day.trim(),
    loc: day.loc.trim(),
    region: day.region.trim(),
    hotel: typeof day.hotel === "string" && day.hotel.trim() ? day.hotel.trim() : null,
    acts: day.acts.map(normalizeActivity)
  };
}

function normalizeTripState(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.days)) {
    throw new TripError("מבנה המסלול לא תקין");
  }

  if (payload.days.length < 1) {
    throw new TripError("המסלול חייב לכלול לפחות יום אחד");
  }

  return {
    days: payload.days.map(normalizeDay)
  };
}

function readBundledSeedState() {
  const raw = readFileSync(bundledSeedFilePath, "utf8");
  return normalizeTripState(JSON.parse(raw));
}

function persistTripState(state, dataFilePath) {
  try {
    mkdirSync(dirname(dataFilePath), { recursive: true });
    const tempFilePath = `${dataFilePath}.tmp`;
    writeFileSync(tempFilePath, JSON.stringify(state, null, 2), "utf8");
    renameSync(tempFilePath, dataFilePath);
  } catch {
    throw new TripError("שמירת המסלול לקובץ נכשלה", 500);
  }
}

function loadOrCreateTripState({ persist, dataFilePath }) {
  if (!persist) {
    return readBundledSeedState();
  }

  try {
    const raw = readFileSync(dataFilePath, "utf8");
    return normalizeTripState(JSON.parse(raw));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new TripError("קריאת קובץ המסלול נכשלה", 500);
    }

    const seed = readBundledSeedState();
    persistTripState(seed, dataFilePath);
    return seed;
  }
}

export function createTripStore({ persist = true, dataFilePath = resolveTripDataPath() } = {}) {
  let state = loadOrCreateTripState({ persist, dataFilePath });

  return {
    getTrip() {
      return clone(state);
    },
    saveTrip(payload) {
      const nextState = normalizeTripState(payload);

      if (persist) {
        persistTripState(nextState, dataFilePath);
      }

      state = nextState;
      return clone(state);
    }
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, error) {
  if (error instanceof TripError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }

  console.error(error);
  sendJson(res, 500, { error: "שגיאת שרת פנימית" });
}

async function parseJsonBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new TripError("גוף הבקשה גדול מדי", 413);
    }
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new TripError("הבקשה חייבת להיות בפורמט JSON תקין");
  }
}

async function serveTripHtml(res, htmlFilePath) {
  const fileBuffer = await readFile(htmlFilePath);
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": fileBuffer.byteLength
  });
  res.end(fileBuffer);
}

export function createTripServer(
  store = createTripStore(),
  { htmlFilePath = resolveTripHtmlPath() } = {}
) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === "/api/health" && req.method === "GET") {
        sendJson(res, 200, {
          status: "ok",
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (pathname === "/api/trip-data" && req.method === "GET") {
        sendJson(res, 200, store.getTrip());
        return;
      }

      if (pathname === "/api/trip-data" && req.method === "PUT") {
        const payload = await parseJsonBody(req);
        const savedTrip = store.saveTrip(payload);
        sendJson(res, 200, savedTrip);
        return;
      }

      if (pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "GET" && (pathname === "/" || pathname === "/רומא_טוסקנה_2026.html")) {
        await serveTripHtml(res, htmlFilePath);
        return;
      }

      sendJson(res, 404, { error: "הנתיב לא נמצא" });
    } catch (error) {
      sendError(res, error);
    }
  });
}

export function startTripServer({
  port = Number(process.env.PORT ?? 8000),
  persistData = process.env.PERSIST_DATA !== "false",
  dataFilePath = resolveTripDataPath(),
  htmlFilePath = resolveTripHtmlPath()
} = {}) {
  const store = createTripStore({ persist: persistData, dataFilePath });
  const server = createTripServer(store, { htmlFilePath });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Trip server is running on http://127.0.0.1:${port}`);
      if (persistData) {
        console.log(`Trip data file: ${dataFilePath}`);
      }
      resolve(server);
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startTripServer();
}
