import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const STATUS_VALUES = new Set(["todo", "in_progress", "done"]);
const PRIORITY_VALUES = new Set(["low", "medium", "high"]);
const VISIBILITY_VALUES = new Set(["private", "workspace"]);
const GOAL_PERIOD_VALUES = new Set(["daily", "weekly", "monthly", "yearly"]);
const GOAL_PERIODS = ["daily", "weekly", "monthly", "yearly"];
const DEFAULT_GOAL_PERIOD = "daily";
const DAILY_GOAL_TASK_LIMIT = 5;
const DEFAULT_CATEGORY = "כללי";
const DEFAULT_CATEGORIES = ["אישי", "עבודה", "בריאות", "לימודים", "משפחה", "כספים", DEFAULT_CATEGORY];

function createSeedData() {
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: "usr_1",
        name: "תום",
        email: "tom@example.com",
        timezone: "Asia/Jerusalem"
      }
    ],
    workspaces: [
      {
        id: "wsp_personal_1",
        name: "המרחב האישי שלי",
        type: "personal",
        ownerUserId: "usr_1",
        createdAt: now
      },
      {
        id: "wsp_team_1",
        name: "צוות מוצר",
        type: "team",
        ownerUserId: "usr_1",
        createdAt: now
      }
    ],
    tasks: [
      {
        id: "tsk_1",
        title: "לתכנן מטרות לשבוע הקרוב",
        description: "לבחור 3 משימות מרכזיות לשבוע",
        goalPeriod: "weekly",
        category: "אישי",
        status: "todo",
        priority: "high",
        dueDate: null,
        workspaceId: "wsp_personal_1",
        visibility: "private",
        ownerUserId: "usr_1",
        assigneeId: "usr_1",
        createdBy: "usr_1",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "tsk_2",
        title: "הכנה לפתיחת ספרינט",
        description: "איסוף סיכונים ולוחות זמנים",
        goalPeriod: "monthly",
        category: "עבודה",
        status: "in_progress",
        priority: "medium",
        dueDate: null,
        workspaceId: "wsp_team_1",
        visibility: "workspace",
        ownerUserId: null,
        assigneeId: "usr_1",
        createdBy: "usr_1",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function isValidStateShape(state) {
  return Boolean(
    state &&
      Array.isArray(state.users) &&
      Array.isArray(state.workspaces) &&
      Array.isArray(state.tasks) &&
      state.users.length > 0
  );
}

function loadOrCreateState({ persist, dataFilePath }) {
  if (!persist) {
    return createSeedData();
  }

  let raw = "";
  try {
    raw = readFileSync(dataFilePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error("קריאת מסד הנתונים נכשלה");
    }

    const seed = createSeedData();
    mkdirSync(dirname(dataFilePath), { recursive: true });
    writeFileSync(dataFilePath, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidStateShape(parsed)) {
      throw new Error("מבנה מסד הנתונים לא תקין");
    }

    return {
      users: parsed.users,
      workspaces: parsed.workspaces,
      tasks: parsed.tasks
    };
  } catch {
    throw new Error("קובץ מסד הנתונים פגום. לא בוצעה דריסה של הנתונים.");
  }
}

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

function normalizeCategory(category) {
  if (typeof category !== "string") {
    return null;
  }

  const clean = category.trim();
  if (clean.length < 2 || clean.length > 24) {
    return null;
  }

  return clean;
}

export function createAppStore({ persist = false, dataFilePath = null } = {}) {
  if (persist && !dataFilePath) {
    throw new AppError("חסר נתיב לשמירת נתונים", 500);
  }

  const state = loadOrCreateState({ persist, dataFilePath });
  const users = state.users;
  const workspaces = state.workspaces;
  const tasks = state.tasks;

  function persistChanges() {
    if (!persist || !dataFilePath) {
      return;
    }

    try {
      mkdirSync(dirname(dataFilePath), { recursive: true });
      const tempPath = `${dataFilePath}.tmp`;
      writeFileSync(tempPath, JSON.stringify({ users, workspaces, tasks }, null, 2), "utf8");
      renameSync(tempPath, dataFilePath);
    } catch {
      throw new AppError("שמירת הנתונים נכשלה", 500);
    }
  }

  function getCurrentUser() {
    return users[0];
  }

  function getWorkspaceOrFail(workspaceId) {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      throw new AppError("מרחב העבודה לא נמצא", 404);
    }
    return workspace;
  }

  function sanitizeTask(task) {
    return { ...task };
  }

  function listWorkspaces() {
    return workspaces.map((item) => ({ ...item }));
  }

  function listCategories() {
    const unique = new Set(DEFAULT_CATEGORIES);

    for (const task of tasks) {
      if (task.category) {
        unique.add(task.category);
      }
    }

    return [...unique];
  }

  function listGoalPeriods() {
    return [...GOAL_PERIODS];
  }

  function createWorkspace(payload) {
    if (!payload?.name || typeof payload.name !== "string") {
      throw new AppError("יש להזין שם למרחב העבודה");
    }

    const cleanName = payload.name.trim();
    if (cleanName.length < 2) {
      throw new AppError("שם המרחב חייב להכיל לפחות 2 תווים");
    }

    const type = payload.type ?? "team";
    if (type !== "team") {
      throw new AppError("ניתן ליצור דרך ה-API רק מרחבי צוות");
    }

    const workspace = {
      id: `wsp_${randomUUID()}`,
      name: cleanName,
      type,
      ownerUserId: getCurrentUser().id,
      createdAt: new Date().toISOString()
    };

    workspaces.push(workspace);
    try {
      persistChanges();
    } catch (error) {
      workspaces.pop();
      throw error;
    }

    return { ...workspace };
  }

  function listTasks(filters = {}) {
    const scope = filters.scope ?? "all";
    const workspaceId = filters.workspaceId ?? null;
    const status = filters.status ?? null;
    const category = filters.category ?? null;
    const goalPeriod = filters.goalPeriod ?? null;

    let result = [...tasks];

    if (scope === "personal") {
      const personalIds = new Set(
        workspaces.filter((item) => item.type === "personal").map((item) => item.id)
      );
      result = result.filter((item) => personalIds.has(item.workspaceId));
    }

    if (scope === "team") {
      const teamIds = new Set(workspaces.filter((item) => item.type === "team").map((item) => item.id));
      result = result.filter((item) => teamIds.has(item.workspaceId));
    }

    if (workspaceId) {
      result = result.filter((item) => item.workspaceId === workspaceId);
    }

    if (status) {
      result = result.filter((item) => item.status === status);
    }

    if (category) {
      result = result.filter((item) => item.category === category);
    }

    if (goalPeriod) {
      result = result.filter((item) => item.goalPeriod === goalPeriod);
    }

    return result.map(sanitizeTask);
  }

  function validateTaskPayload(payload, options = { partial: false }) {
    const partial = options.partial ?? false;

    if (!partial || payload.title !== undefined) {
      if (typeof payload.title !== "string" || payload.title.trim().length < 2) {
        throw new AppError("כותרת המשימה חייבת להכיל לפחות 2 תווים");
      }
    }

    if (!partial || payload.priority !== undefined) {
      if (!PRIORITY_VALUES.has(payload.priority)) {
        throw new AppError("עדיפות המשימה לא תקינה");
      }
    }

    if (!partial || payload.status !== undefined) {
      if (!STATUS_VALUES.has(payload.status)) {
        throw new AppError("סטטוס המשימה לא תקין");
      }
    }

    if (payload.visibility !== undefined && !VISIBILITY_VALUES.has(payload.visibility)) {
      throw new AppError("נראות המשימה לא תקינה");
    }

    if (payload.goalPeriod !== undefined && !GOAL_PERIOD_VALUES.has(payload.goalPeriod)) {
      throw new AppError("סוג המטרה לא תקין");
    }

    if (payload.category !== undefined && normalizeCategory(payload.category) === null) {
      throw new AppError("הקטגוריה חייבת להכיל בין 2 ל-24 תווים");
    }
  }

  function enforceWorkspaceRules(workspace, payload) {
    if (workspace.type === "personal") {
      const requestedVisibility = payload.visibility ?? "private";
      if (requestedVisibility !== "private") {
        throw new AppError("משימות אישיות חייבות להישאר פרטיות");
      }

      if (payload.assigneeId && payload.assigneeId !== getCurrentUser().id) {
        throw new AppError("במשימה אישית ניתן לשייך רק למשתמש הנוכחי");
      }
    }
  }

  function countTasksByGoalPeriod(workspaceId, goalPeriod, excludedTaskId = null) {
    return tasks.filter((item) => {
      if (excludedTaskId && item.id === excludedTaskId) {
        return false;
      }

      return (
        item.workspaceId === workspaceId &&
        (item.goalPeriod ?? DEFAULT_GOAL_PERIOD) === goalPeriod &&
        item.status !== "done"
      );
    }).length;
  }

  function enforceGoalPeriodLimit(workspaceId, goalPeriod, excludedTaskId = null) {
    if (goalPeriod !== "daily") {
      return;
    }

    const dailyTasksCount = countTasksByGoalPeriod(workspaceId, "daily", excludedTaskId);
    if (dailyTasksCount >= DAILY_GOAL_TASK_LIMIT) {
      throw new AppError("ניתן ליצור עד 5 משימות במטרה יומית בכל מרחב");
    }
  }

  function createTask(payload) {
    if (!payload || typeof payload !== "object") {
      throw new AppError("חובה לשלוח נתוני משימה");
    }

    if (!payload.workspaceId) {
      throw new AppError("יש לבחור מרחב עבודה");
    }

    validateTaskPayload(payload);

    const workspace = getWorkspaceOrFail(payload.workspaceId);
    enforceWorkspaceRules(workspace, payload);
    const goalPeriod = payload.goalPeriod ?? DEFAULT_GOAL_PERIOD;
    enforceGoalPeriodLimit(workspace.id, goalPeriod);

    const now = new Date().toISOString();
    const task = {
      id: `tsk_${randomUUID()}`,
      title: payload.title.trim(),
      description: (payload.description ?? "").trim(),
      goalPeriod,
      category: normalizeCategory(payload.category) ?? DEFAULT_CATEGORY,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate ?? null,
      workspaceId: workspace.id,
      visibility: payload.visibility ?? (workspace.type === "personal" ? "private" : "workspace"),
      ownerUserId: workspace.type === "personal" ? getCurrentUser().id : null,
      assigneeId: payload.assigneeId ?? getCurrentUser().id,
      createdBy: getCurrentUser().id,
      createdAt: now,
      updatedAt: now
    };

    tasks.push(task);
    try {
      persistChanges();
    } catch (error) {
      tasks.pop();
      throw error;
    }

    return sanitizeTask(task);
  }

  function updateTask(taskId, updates) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new AppError("המשימה לא נמצאה", 404);
    }

    if (!updates || typeof updates !== "object") {
      throw new AppError("חובה לשלוח נתוני עדכון");
    }

    validateTaskPayload(
      {
        title: updates.title === undefined ? task.title : updates.title,
        priority: updates.priority === undefined ? task.priority : updates.priority,
        status: updates.status === undefined ? task.status : updates.status,
        visibility: updates.visibility === undefined ? task.visibility : updates.visibility,
        goalPeriod: updates.goalPeriod === undefined ? task.goalPeriod : updates.goalPeriod,
        category: updates.category === undefined ? task.category : updates.category
      },
      { partial: true }
    );

    const nextWorkspaceId = updates.workspaceId ?? task.workspaceId;
    const nextGoalPeriod = updates.goalPeriod ?? task.goalPeriod;
    const workspace = getWorkspaceOrFail(nextWorkspaceId);
    enforceWorkspaceRules(workspace, {
      visibility: updates.visibility ?? task.visibility,
      assigneeId: updates.assigneeId ?? task.assigneeId
    });
    enforceGoalPeriodLimit(nextWorkspaceId, nextGoalPeriod, task.id);

    const previous = { ...task };

    task.title = updates.title === undefined ? task.title : updates.title.trim();
    task.description = updates.description === undefined ? task.description : updates.description.trim();
    task.goalPeriod = nextGoalPeriod;
    task.category = updates.category === undefined ? task.category : normalizeCategory(updates.category);
    task.priority = updates.priority ?? task.priority;
    task.status = updates.status ?? task.status;
    task.dueDate = updates.dueDate === undefined ? task.dueDate : updates.dueDate;
    task.workspaceId = nextWorkspaceId;
    task.visibility = updates.visibility ?? task.visibility;
    task.assigneeId = updates.assigneeId ?? task.assigneeId;
    task.ownerUserId = workspace.type === "personal" ? getCurrentUser().id : null;
    task.updatedAt = new Date().toISOString();

    try {
      persistChanges();
    } catch (error) {
      Object.assign(task, previous);
      throw error;
    }

    return sanitizeTask(task);
  }

  function deleteTask(taskId) {
    const index = tasks.findIndex((item) => item.id === taskId);
    if (index === -1) {
      throw new AppError("המשימה לא נמצאה", 404);
    }

    const [removed] = tasks.splice(index, 1);
    try {
      persistChanges();
    } catch (error) {
      tasks.splice(index, 0, removed);
      throw error;
    }

    return sanitizeTask(removed);
  }

  function getOverview() {
    const stats = {
      personal: { todo: 0, in_progress: 0, done: 0, total: 0 },
      team: { todo: 0, in_progress: 0, done: 0, total: 0 }
    };

    for (const task of tasks) {
      const workspace = getWorkspaceOrFail(task.workspaceId);
      const bucket = workspace.type === "personal" ? stats.personal : stats.team;
      bucket[task.status] += 1;
      bucket.total += 1;
    }

    return stats;
  }

  return {
    getCurrentUser,
    listWorkspaces,
    listCategories,
    listGoalPeriods,
    createWorkspace,
    listTasks,
    createTask,
    updateTask,
    deleteTask,
    getOverview
  };
}
