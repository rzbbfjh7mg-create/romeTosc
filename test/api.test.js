import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAppServer } from "../src/server.js";
import { createAppStore } from "../src/store.js";

function jsonRequest(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, options).then(async (response) => {
    const payload = await response.json();
    return { response, payload };
  });
}

async function withServer(run, { store } = {}) {
  const server = createAppServer(store);

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

test("bootstrap returns personal and team workspaces", async () => {
  await withServer(async (baseUrl) => {
    const { response, payload } = await jsonRequest(baseUrl, "/api/bootstrap");
    assert.equal(response.status, 200);

    const types = new Set(payload.workspaces.map((workspace) => workspace.type));
    assert.equal(types.has("personal"), true);
    assert.equal(types.has("team"), true);
    assert.equal(Array.isArray(payload.categories), true);
    assert.equal(payload.categories.includes("אישי"), true);
    assert.equal(Array.isArray(payload.goalPeriods), true);
    assert.equal(payload.goalPeriods.includes("daily"), true);
  });
});

test("serves static frontend assets", async () => {
  await withServer(async (baseUrl) => {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/i);

    const appScript = await fetch(`${baseUrl}/app.js`);
    assert.equal(appScript.status, 200);
    assert.match(appScript.headers.get("content-type"), /javascript/i);
  });
});

test("personal workspace rejects non-private visibility", async () => {
  await withServer(async (baseUrl) => {
    const boot = await jsonRequest(baseUrl, "/api/bootstrap");
    const personalWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "personal");

    const { response, payload } = await jsonRequest(baseUrl, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Invalid visibility",
        description: "should fail",
        workspaceId: personalWorkspace.id,
        priority: "medium",
        status: "todo",
        visibility: "workspace"
      })
    });

    assert.equal(response.status, 400);
    assert.match(payload.error, /פרט/i);
  });
});

test("team scope returns only tasks from team workspaces", async () => {
  await withServer(async (baseUrl) => {
    const boot = await jsonRequest(baseUrl, "/api/bootstrap");
    const teamWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "team");

    const created = await jsonRequest(baseUrl, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Team-only task",
        description: "for the squad",
        workspaceId: teamWorkspace.id,
        priority: "high",
        status: "todo"
      })
    });

    assert.equal(created.response.status, 201);

    const teamTasks = await jsonRequest(baseUrl, "/api/tasks?scope=team");
    assert.equal(teamTasks.response.status, 200);

    const workspaceTypes = teamTasks.payload.data.map((task) => {
      const workspace = boot.payload.workspaces.find((item) => item.id === task.workspaceId);
      return workspace?.type;
    });

    assert.equal(workspaceTypes.every((type) => type === "team"), true);
  });
});

test("creates task with custom category and returns it in categories endpoint", async () => {
  await withServer(async (baseUrl) => {
    const boot = await jsonRequest(baseUrl, "/api/bootstrap");
    const teamWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "team");

    const created = await jsonRequest(baseUrl, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "בדיקת קטגוריה",
        description: "לוודא שנשמרת קטגוריה",
        workspaceId: teamWorkspace.id,
        goalPeriod: "weekly",
        priority: "medium",
        status: "todo",
        category: "בריאות"
      })
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.payload.data.category, "בריאות");
    assert.equal(created.payload.data.goalPeriod, "weekly");

    const categories = await jsonRequest(baseUrl, "/api/categories");
    assert.equal(categories.response.status, 200);
    assert.equal(categories.payload.data.includes("בריאות"), true);
  });
});

test("deletes task by id and removes it from tasks list", async () => {
  await withServer(async (baseUrl) => {
    const boot = await jsonRequest(baseUrl, "/api/bootstrap");
    const teamWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "team");

    const created = await jsonRequest(baseUrl, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "משימה למחיקה מהירה",
        description: "",
        workspaceId: teamWorkspace.id,
        goalPeriod: "daily",
        priority: "medium",
        status: "todo"
      })
    });

    assert.equal(created.response.status, 201);
    const taskId = created.payload.data.id;

    const removed = await jsonRequest(baseUrl, `/api/tasks/${taskId}`, {
      method: "DELETE"
    });

    assert.equal(removed.response.status, 200);
    assert.equal(removed.payload.data.id, taskId);

    const allTasks = await jsonRequest(baseUrl, "/api/tasks?scope=all");
    assert.equal(allTasks.response.status, 200);
    assert.equal(allTasks.payload.data.some((task) => task.id === taskId), false);
  });
});

test("daily goal is limited to 5 tasks per workspace", async () => {
  await withServer(async (baseUrl) => {
    const boot = await jsonRequest(baseUrl, "/api/bootstrap");
    const personalWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "personal");

    for (let index = 0; index < 5; index += 1) {
      const created = await jsonRequest(baseUrl, "/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `משימה יומית ${index + 1}`,
          description: "",
          workspaceId: personalWorkspace.id,
          goalPeriod: "daily",
          priority: "medium",
          status: "todo"
        })
      });

      assert.equal(created.response.status, 201);
    }

    const overflow = await jsonRequest(baseUrl, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "משימה יומית נוספת",
        description: "",
        workspaceId: personalWorkspace.id,
        goalPeriod: "daily",
        priority: "medium",
        status: "todo"
      })
    });

    assert.equal(overflow.response.status, 400);
    assert.match(overflow.payload.error, /5/);
  });
});

test("daily goal limit ignores tasks already marked done", async () => {
  await withServer(async (baseUrl) => {
    const boot = await jsonRequest(baseUrl, "/api/bootstrap");
    const personalWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "personal");

    const created = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await jsonRequest(baseUrl, "/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `משימת יומי לבדיקה ${index + 1}`,
          description: "",
          workspaceId: personalWorkspace.id,
          goalPeriod: "daily",
          priority: "medium",
          status: "todo"
        })
      });
      created.push(response);
      assert.equal(response.response.status, 201);
    }

    const firstTaskId = created[0].payload.data.id;
    const markedDone = await jsonRequest(baseUrl, `/api/tasks/${firstTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    assert.equal(markedDone.response.status, 200);

    const extra = await jsonRequest(baseUrl, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "משימה חדשה אחרי done",
        description: "",
        workspaceId: personalWorkspace.id,
        goalPeriod: "daily",
        priority: "medium",
        status: "todo"
      })
    });

    assert.equal(extra.response.status, 201);
  });
});

test("persists tasks to disk between restarts", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "dual-mode-task-manager-"));
  const dataFilePath = join(tempDir, "tasks-db.json");

  try {
    await withServer(
      async (baseUrl) => {
        const boot = await jsonRequest(baseUrl, "/api/bootstrap");
        const personalWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "personal");

        const created = await jsonRequest(baseUrl, "/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "בדיקת שמירה לדיסק",
            description: "",
            workspaceId: personalWorkspace.id,
            goalPeriod: "weekly",
            priority: "medium",
            status: "todo"
          })
        });

        assert.equal(created.response.status, 201);
      },
      { store: createAppStore({ persist: true, dataFilePath }) }
    );

    await withServer(
      async (baseUrl) => {
        const tasks = await jsonRequest(baseUrl, "/api/tasks?scope=all");
        assert.equal(tasks.response.status, 200);
        assert.equal(tasks.payload.data.some((task) => task.title === "בדיקת שמירה לדיסק"), true);
      },
      { store: createAppStore({ persist: true, dataFilePath }) }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("marking task as done does not delete it from DB", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "dual-mode-task-manager-done-"));
  const dataFilePath = join(tempDir, "tasks-db.json");
  let taskId = "";

  try {
    await withServer(
      async (baseUrl) => {
        const boot = await jsonRequest(baseUrl, "/api/bootstrap");
        const teamWorkspace = boot.payload.workspaces.find((workspace) => workspace.type === "team");

        const created = await jsonRequest(baseUrl, "/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "משימה שנשמרת כ-done",
            description: "",
            workspaceId: teamWorkspace.id,
            goalPeriod: "monthly",
            priority: "medium",
            status: "todo"
          })
        });

        assert.equal(created.response.status, 201);
        taskId = created.payload.data.id;

        const markedDone = await jsonRequest(baseUrl, `/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" })
        });

        assert.equal(markedDone.response.status, 200);
        assert.equal(markedDone.payload.data.status, "done");
      },
      { store: createAppStore({ persist: true, dataFilePath }) }
    );

    await withServer(
      async (baseUrl) => {
        const tasks = await jsonRequest(baseUrl, "/api/tasks?scope=all");
        assert.equal(tasks.response.status, 200);

        const savedTask = tasks.payload.data.find((task) => task.id === taskId);
        assert.equal(Boolean(savedTask), true);
        assert.equal(savedTask.status, "done");
      },
      { store: createAppStore({ persist: true, dataFilePath }) }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
