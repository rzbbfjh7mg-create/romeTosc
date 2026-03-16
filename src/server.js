import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, createAppStore } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = normalize(join(__dirname, "..", "public"));

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, error) {
  if (error instanceof AppError) {
    return sendJson(res, error.statusCode, {
      error: error.message
    });
  }

  console.error(error);
  return sendJson(res, 500, {
    error: "שגיאת שרת פנימית"
  });
}

async function parseJsonBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new AppError("גוף הבקשה גדול מדי", 413);
    }
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new AppError("הבקשה חייבת להיות בפורמט JSON תקין");
  }
}

function getFilePath(urlPath) {
  const targetPath = urlPath === "/" ? "index.html" : urlPath;
  const safePath = normalize(targetPath)
    .replace(/^[/\\]+/, "")
    .replace(/^([.]{2}[/\\])+/, "");
  return normalize(join(publicDir, safePath));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const filePath = getFilePath(url.pathname);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "אין הרשאה לגשת לקובץ" });
    return;
  }

  try {
    const fileBuffer = await readFile(filePath);
    const contentType = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": fileBuffer.byteLength
    });
    res.end(fileBuffer);
  } catch {
    if (url.pathname !== "/") {
      const fallback = await readFile(join(publicDir, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": fallback.byteLength
      });
      res.end(fallback);
      return;
    }

    sendJson(res, 404, { error: "העמוד לא נמצא" });
  }
}

export function createAppServer(store = createAppStore()) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      try {
        if (req.method === "GET" && url.pathname === "/api/health") {
          sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/bootstrap") {
          sendJson(res, 200, {
            user: store.getCurrentUser(),
            workspaces: store.listWorkspaces(),
            categories: store.listCategories(),
            goalPeriods: store.listGoalPeriods(),
            tasks: store.listTasks({ scope: "all" }),
            overview: store.getOverview()
          });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/workspaces") {
          sendJson(res, 200, { data: store.listWorkspaces() });
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/workspaces") {
          const payload = await parseJsonBody(req);
          const workspace = store.createWorkspace(payload);
          sendJson(res, 201, { data: workspace });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/tasks") {
          const tasks = store.listTasks({
            scope: url.searchParams.get("scope") ?? "all",
            workspaceId: url.searchParams.get("workspaceId") ?? null,
            status: url.searchParams.get("status") ?? null,
            category: url.searchParams.get("category") ?? null,
            goalPeriod: url.searchParams.get("goalPeriod") ?? null
          });

          sendJson(res, 200, { data: tasks });
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/tasks") {
          const payload = await parseJsonBody(req);
          const task = store.createTask(payload);
          sendJson(res, 201, { data: task });
          return;
        }

        if (req.method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
          const taskId = url.pathname.split("/").at(-1);
          if (!taskId) {
            throw new AppError("חסר מזהה משימה");
          }

          const payload = await parseJsonBody(req);
          const task = store.updateTask(taskId, payload);
          sendJson(res, 200, { data: task });
          return;
        }

        if (req.method === "DELETE" && url.pathname.startsWith("/api/tasks/")) {
          const taskId = url.pathname.split("/").at(-1);
          if (!taskId) {
            throw new AppError("חסר מזהה משימה");
          }

          const task = store.deleteTask(taskId);
          sendJson(res, 200, { data: task });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/overview") {
          sendJson(res, 200, { data: store.getOverview() });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/categories") {
          sendJson(res, 200, { data: store.listCategories() });
          return;
        }

        sendJson(res, 404, { error: "נתיב API לא נמצא" });
      } catch (error) {
        sendError(res, error);
      }

      return;
    }

    await serveStatic(req, res);
  });
}

function resolveDataFilePath() {
  return process.env.APP_DATA_FILE ?? join(process.cwd(), "data", "tasks-db.json");
}

export function startServer({ port = 3000, persistData = true, dataFilePath = resolveDataFilePath() } = {}) {
  const store = createAppStore({
    persist: persistData,
    dataFilePath
  });
  const server = createAppServer(store);

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      if (persistData) {
        console.log(`Data persistence file: ${dataFilePath}`);
      }
      resolve(server);
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer({
    port: Number(process.env.PORT ?? 3000),
    persistData: process.env.PERSIST_DATA !== "false",
    dataFilePath: resolveDataFilePath()
  });
}
