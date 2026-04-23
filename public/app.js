const state = {
  user: null,
  workspaces: [],
  categories: [],
  goalPeriods: [],
  tasks: [],
  overview: null,
  ui: {
    workspaceCollapsed: {
      personal: false,
      team: false
    },
    goalCollapsed: {},
    workspaceOrder: ["personal", "team"],
    workspaceWidths: {
      personal: "normal",
      team: "normal"
    },
    draggingTaskId: null,
    currentSection: "overviewSection",
    showCompletedTasks: false
  }
};

const defaultCategories = ["אישי", "עבודה", "בריאות", "לימודים", "משפחה", "כספים", "כללי"];
const defaultGoalPeriods = ["daily", "weekly", "monthly", "yearly"];
const DAILY_GOAL_TASK_LIMIT = 5;
const WORKSPACE_WIDTH_VALUES = new Set(["narrow", "normal", "wide"]);
const WORKSPACE_WIDTH_FRACTIONS = {
  narrow: 0.85,
  normal: 1,
  wide: 1.25
};
const WORKSPACE_COLLAPSED_FRACTION = 0.34;

const priorityLabels = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה"
};

const statusLabels = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  done: "הושלם"
};

const workspaceTypeLabels = {
  personal: "אישי",
  team: "עבודה"
};

const goalPeriodLabels = {
  daily: "מטרה יומית",
  weekly: "מטרה שבועית",
  monthly: "מטרה חודשית",
  yearly: "מטרה שנתית"
};

const THEME_STORAGE_KEY = "dual_mode_theme";
const LAYOUT_STORAGE_KEY = "dual_mode_layout";
const SECTION_TARGET_IDS = ["overviewSection", "personalPanel", "workPanel", "additionalSection"];

const elements = {
  sectionNav: document.querySelector("#sectionNav"),
  sidebarAddTaskBtn: document.querySelector("#sidebarAddTaskBtn"),
  completedToggleBtn: document.querySelector("#completedToggleBtn"),
  overviewSection: document.querySelector("#overviewSection"),
  additionalSection: document.querySelector("#additionalSection"),
  stats: document.querySelector("#stats"),
  workspaceGrid: document.querySelector("#workspaceGrid"),
  personalPanel: document.querySelector("#personalPanel"),
  workPanel: document.querySelector("#workPanel"),
  personalWorkspace: document.querySelector("#personalWorkspace"),
  workWorkspace: document.querySelector("#workWorkspace"),
  personalCount: document.querySelector("#personalCount"),
  workCount: document.querySelector("#workCount"),
  personalMoveBtn: document.querySelector("#personalMoveBtn"),
  workMoveBtn: document.querySelector("#workMoveBtn"),
  personalWidthSelect: document.querySelector("#personalWidthSelect"),
  workWidthSelect: document.querySelector("#workWidthSelect"),
  personalToggleBtn: document.querySelector("#personalToggleBtn"),
  workToggleBtn: document.querySelector("#workToggleBtn"),
  personalAddBtn: document.querySelector("#personalAddBtn"),
  workAddBtn: document.querySelector("#workAddBtn"),
  taskModal: document.querySelector("#taskModal"),
  taskModalBackdrop: document.querySelector("#taskModalBackdrop"),
  taskForm: document.querySelector("#taskForm"),
  closeTaskMenuBtn: document.querySelector("#closeTaskMenuBtn"),
  taskFeedback: document.querySelector("#taskFeedback"),
  workspaceForm: document.querySelector("#workspaceForm"),
  workspaceFeedback: document.querySelector("#workspaceFeedback"),
  workspaceSelect: document.querySelector("#workspaceSelect"),
  workspaceRuleHint: document.querySelector("#workspaceRuleHint"),
  categoryInput: document.querySelector("#categoryInput"),
  goalPeriodSelect: document.querySelector("#goalPeriodSelect"),
  categoryOptions: document.querySelector("#categoryOptions"),
  categorySuggestions: document.querySelector("#categorySuggestions"),
  taskSubmitBtn: document.querySelector("#taskSubmitBtn"),
  workspaceSubmitBtn: document.querySelector("#workspaceSubmitBtn"),
  userGreeting: document.querySelector("#userGreeting"),
  themeToggleBtn: document.querySelector("#themeToggleBtn")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setFeedback(element, message, tone = "") {
  element.textContent = message;
  element.className = `feedback ${tone}`.trim();
}

function setQuickAddFeedback(form, message, tone = "") {
  const feedback = form.querySelector(".quick-add-feedback");
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.className = `quick-add-feedback ${tone}`.trim();
}

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "dark" || value === "light") {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

function readStoredLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const workspaceCollapsed = {
      personal: Boolean(parsed?.workspaceCollapsed?.personal),
      team: Boolean(parsed?.workspaceCollapsed?.team)
    };

    const goalCollapsed = {};
    if (parsed?.goalCollapsed && typeof parsed.goalCollapsed === "object") {
      for (const [key, value] of Object.entries(parsed.goalCollapsed)) {
        if (typeof key === "string" && key.includes(":")) {
          goalCollapsed[key] = Boolean(value);
        }
      }
    }

    const order = Array.isArray(parsed?.workspaceOrder) ? parsed.workspaceOrder : ["personal", "team"];
    const uniqueOrder = [...new Set(order.filter((item) => item === "personal" || item === "team"))];
    if (!uniqueOrder.includes("personal")) {
      uniqueOrder.push("personal");
    }
    if (!uniqueOrder.includes("team")) {
      uniqueOrder.push("team");
    }

    const workspaceWidths = {
      personal: WORKSPACE_WIDTH_VALUES.has(parsed?.workspaceWidths?.personal)
        ? parsed.workspaceWidths.personal
        : "normal",
      team: WORKSPACE_WIDTH_VALUES.has(parsed?.workspaceWidths?.team) ? parsed.workspaceWidths.team : "normal"
    };

    const currentSection = SECTION_TARGET_IDS.includes(parsed?.currentSection) ? parsed.currentSection : "overviewSection";
    const showCompletedTasks = Boolean(parsed?.showCompletedTasks);

    return { workspaceCollapsed, goalCollapsed, workspaceOrder: uniqueOrder, workspaceWidths, currentSection, showCompletedTasks };
  } catch {
    return null;
  }
}

function saveLayout() {
  try {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        workspaceCollapsed: state.ui.workspaceCollapsed,
        goalCollapsed: state.ui.goalCollapsed,
        workspaceOrder: state.ui.workspaceOrder,
        workspaceWidths: state.ui.workspaceWidths,
        currentSection: state.ui.currentSection,
        showCompletedTasks: state.ui.showCompletedTasks
      })
    );
  } catch {
    return;
  }
}

function goalKey(workspaceType, goalPeriod) {
  return `${workspaceType}:${goalPeriod}`;
}

function isWorkspaceCollapsed(workspaceType) {
  return Boolean(state.ui.workspaceCollapsed[workspaceType]);
}

function isGoalCollapsed(workspaceType, goalPeriod) {
  return Boolean(state.ui.goalCollapsed[goalKey(workspaceType, goalPeriod)]);
}

function setWorkspaceCollapsed(workspaceType, collapsed) {
  state.ui.workspaceCollapsed[workspaceType] = Boolean(collapsed);
  saveLayout();
}

function toggleWorkspaceCollapsed(workspaceType) {
  setWorkspaceCollapsed(workspaceType, !isWorkspaceCollapsed(workspaceType));
  renderBoards();
}

function reverseWorkspaceOrder() {
  state.ui.workspaceOrder = [...state.ui.workspaceOrder].reverse();
  saveLayout();
  applyWorkspaceLayout();
}

function setWorkspaceWidth(workspaceType, width) {
  if (!WORKSPACE_WIDTH_VALUES.has(width)) {
    return;
  }

  state.ui.workspaceWidths[workspaceType] = width;
  saveLayout();
  applyWorkspaceLayout();
}

function setGoalCollapsed(workspaceType, goalPeriod, collapsed) {
  state.ui.goalCollapsed[goalKey(workspaceType, goalPeriod)] = Boolean(collapsed);
  saveLayout();
}

function toggleGoalCollapsed(workspaceType, goalPeriod) {
  setGoalCollapsed(workspaceType, goalPeriod, !isGoalCollapsed(workspaceType, goalPeriod));
  renderBoards();
}

function getInitialTheme() {
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function getThemeToggleIconMarkup(isDark) {
  if (isDark) {
    return `
      <span class="side-menu-action-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M6.76 4.84 5.35 3.43 3.93 4.85l1.41 1.41zM1 13h3v-2H1zm10-9h2V1h-2zm7.66 1.85 1.41-1.41-1.41-1.42-1.42 1.41zM17.24 19.16l1.42 1.41 1.41-1.41-1.41-1.42zM20 13h3v-2h-3zM12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm-1 17h2v-3h-2zm-7.07-3.93 1.42 1.42 1.41-1.41-1.41-1.42z" />
        </svg>
      </span>
    `;
  }

  return `
    <span class="side-menu-action-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M21 12.79A9 9 0 0 1 11.21 3a9 9 0 1 0 9.58 9.79z" />
      </svg>
    </span>
  `;
}

function applyTheme(theme, { persist = true } = {}) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  elements.themeToggleBtn.innerHTML = getThemeToggleIconMarkup(isDark);
  elements.themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  elements.themeToggleBtn.setAttribute("aria-label", isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה");
  elements.themeToggleBtn.setAttribute("title", isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה");

  if (persist) {
    saveTheme(isDark ? "dark" : "light");
  }
}

function normalizeCategory(value) {
  const clean = String(value || "").trim();
  return clean.length >= 2 ? clean : "";
}

function setCategories(categories) {
  const unique = new Set(defaultCategories);

  for (const category of categories || []) {
    const clean = normalizeCategory(category);
    if (clean) {
      unique.add(clean);
    }
  }

  state.categories = [...unique];
}

function setGoalPeriods(goalPeriods) {
  const unique = new Set(defaultGoalPeriods);

  for (const goalPeriod of goalPeriods || []) {
    if (goalPeriodLabels[goalPeriod]) {
      unique.add(goalPeriod);
    }
  }

  state.goalPeriods = [...unique].filter((goalPeriod) => goalPeriodLabels[goalPeriod]);
}

function refreshCategoryOptions() {
  elements.categoryOptions.innerHTML = state.categories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

function refreshGoalPeriodOptions() {
  const goals = state.goalPeriods.length ? state.goalPeriods : defaultGoalPeriods;
  elements.goalPeriodSelect.innerHTML = goals
    .map((goalPeriod) => {
      const label = goalPeriodLabels[goalPeriod] ?? goalPeriod;
      return `<option value="${goalPeriod}">${escapeHtml(label)}</option>`;
    })
    .join("");
  elements.goalPeriodSelect.value = state.goalPeriods.includes("daily") ? "daily" : state.goalPeriods[0] ?? "daily";
}

function formatDate(value) {
  if (!value) {
    return "ללא תאריך יעד";
  }

  const [year, month, day] = String(value)
    .split("-")
    .map((part) => Number(part));

  if (!year || !month || !day) {
    return "תאריך לא תקין";
  }

  return new Date(year, month - 1, day).toLocaleDateString("he-IL");
}

function workspaceById(id) {
  return state.workspaces.find((workspace) => workspace.id === id) ?? null;
}

function taskById(id) {
  return state.tasks.find((task) => task.id === id) ?? null;
}

function findWorkspaceIdByType(type) {
  return state.workspaces.find((workspace) => workspace.type === type)?.id ?? "";
}

function preferredWorkspaceId() {
  const personal = state.workspaces.find((workspace) => workspace.type === "personal");
  return personal?.id ?? state.workspaces[0]?.id ?? "";
}

function countTasksByGoalPeriod(workspaceId, goalPeriod, excludedTaskId = null) {
  return state.tasks.filter((task) => {
    if (excludedTaskId && task.id === excludedTaskId) {
      return false;
    }

    return task.workspaceId === workspaceId && (task.goalPeriod ?? "daily") === goalPeriod && task.status !== "done";
  }).length;
}

function isDailyGoalLimitReached(workspaceId, excludedTaskId = null) {
  return countTasksByGoalPeriod(workspaceId, "daily", excludedTaskId) >= DAILY_GOAL_TASK_LIMIT;
}

function openTaskMenu(mode = "personal") {
  elements.taskModal.classList.remove("is-hidden");
  elements.taskModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  elements.taskFeedback.textContent = "";
  elements.taskForm.reset();

  const preferredType = mode === "team" ? "team" : "personal";
  const workspaceId = findWorkspaceIdByType(preferredType) || preferredWorkspaceId();
  if (workspaceId) {
    elements.workspaceSelect.value = workspaceId;
  }
  elements.goalPeriodSelect.value = "daily";

  updateWorkspaceRuleHint();
  elements.categoryInput.focus();
}

function closeTaskMenu() {
  elements.taskModal.classList.add("is-hidden");
  elements.taskModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  elements.taskFeedback.textContent = "";
}

function updateWorkspaceRuleHint() {
  const selected = workspaceById(elements.workspaceSelect.value);
  if (!selected) {
    elements.workspaceRuleHint.textContent = "";
    return;
  }

  if (selected.type === "personal") {
    elements.workspaceRuleHint.textContent = "מרחב אישי: המשימה תהיה פרטית ותשויך רק אליך.";
    return;
  }

  elements.workspaceRuleHint.textContent = "מרחב עבודה: המשימה גלויה לחברי המרחב ומיועדת לשיתוף פעולה.";
}

function refreshWorkspaceOptions() {
  const sortedWorkspaces = [...state.workspaces].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "personal" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "he");
  });

  elements.workspaceSelect.innerHTML = sortedWorkspaces
    .map((workspace) => {
      const workspaceLabel = workspaceTypeLabels[workspace.type] ?? workspace.type;
      return `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)} (${workspaceLabel})</option>`;
    })
    .join("");

  elements.workspaceSelect.value = preferredWorkspaceId();
  updateWorkspaceRuleHint();
}

function setActiveSectionLink(targetId) {
  if (!elements.sectionNav) {
    return;
  }

  const links = elements.sectionNav.querySelectorAll(".side-menu-link[data-section-target]");
  links.forEach((link) => {
    const isActive = link.dataset.sectionTarget === targetId;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function applyCompletedToggle() {
  if (!elements.completedToggleBtn) {
    return;
  }

  const isShowingCompleted = state.ui.showCompletedTasks;
  elements.completedToggleBtn.textContent = isShowingCompleted ? "הסתר משימות שהושלמו" : "הצג משימות שהושלמו";
  elements.completedToggleBtn.setAttribute("aria-pressed", String(isShowingCompleted));
}

function applySectionView() {
  const isOverview = state.ui.currentSection === "overviewSection";
  const isPersonal = state.ui.currentSection === "personalPanel";
  const isWork = state.ui.currentSection === "workPanel";
  const isAdditional = state.ui.currentSection === "additionalSection";

  elements.overviewSection?.classList.toggle("content-section-hidden", !isOverview);
  elements.stats.classList.toggle("content-section-hidden", !isOverview);
  elements.additionalSection?.classList.toggle("content-section-hidden", !isOverview && !isAdditional);
  elements.workspaceGrid.classList.toggle("content-section-hidden", isAdditional);
  elements.workspaceGrid.classList.toggle("single-panel-view", isPersonal || isWork);
  elements.personalPanel.classList.toggle("content-section-hidden", isWork || isAdditional);
  elements.workPanel.classList.toggle("content-section-hidden", isPersonal || isAdditional);
}

function setSectionView(targetId) {
  const nextTargetId = SECTION_TARGET_IDS.includes(targetId) ? targetId : "overviewSection";
  const target = document.getElementById(nextTargetId);
  if (!target) {
    return;
  }

  if (nextTargetId === "personalPanel" && isWorkspaceCollapsed("personal")) {
    setWorkspaceCollapsed("personal", false);
  }

  if (nextTargetId === "workPanel" && isWorkspaceCollapsed("team")) {
    setWorkspaceCollapsed("team", false);
  }

  state.ui.currentSection = nextTargetId;
  saveLayout();
  applySectionView();
  setActiveSectionLink(nextTargetId);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function initSectionNavigation() {
  if (!elements.sectionNav) {
    return;
  }

  elements.sectionNav.addEventListener("click", (event) => {
    const button = event.target.closest(".side-menu-link[data-section-target]");
    if (!button) {
      return;
    }

    setSectionView(button.dataset.sectionTarget || "overviewSection");
  });
}

function applyWorkspaceVisibility(type) {
  const isPersonal = type === "personal";
  const panel = isPersonal ? elements.personalPanel : elements.workPanel;
  const board = isPersonal ? elements.personalWorkspace : elements.workWorkspace;
  const toggleBtn = isPersonal ? elements.personalToggleBtn : elements.workToggleBtn;
  const collapsed = isWorkspaceCollapsed(type);

  panel.classList.toggle("is-collapsed", collapsed);
  board.classList.toggle("is-hidden", collapsed);
  toggleBtn.textContent = collapsed ? "הרחב מרחב" : "צמצם מרחב";
  toggleBtn.setAttribute("aria-label", collapsed ? "הרחבת מרחב" : "צמצום מרחב");
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
}

function applyWorkspaceLayout() {
  const order = state.ui.workspaceOrder;
  const panelsByType = {
    personal: elements.personalPanel,
    team: elements.workPanel
  };

  for (const workspaceType of order) {
    const panel = panelsByType[workspaceType];
    if (panel) {
      elements.workspaceGrid.appendChild(panel);
    }
  }

  const firstType = order[0] ?? "personal";
  const secondType = order[1] ?? "team";
  const firstWidth = isWorkspaceCollapsed(firstType)
    ? WORKSPACE_COLLAPSED_FRACTION
    : WORKSPACE_WIDTH_FRACTIONS[state.ui.workspaceWidths[firstType] ?? "normal"] ?? 1;
  const secondWidth = isWorkspaceCollapsed(secondType)
    ? WORKSPACE_COLLAPSED_FRACTION
    : WORKSPACE_WIDTH_FRACTIONS[state.ui.workspaceWidths[secondType] ?? "normal"] ?? 1;

  elements.workspaceGrid.style.setProperty("--workspace-col-1", `${firstWidth}fr`);
  elements.workspaceGrid.style.setProperty("--workspace-col-2", `${secondWidth}fr`);

  elements.personalWidthSelect.value = state.ui.workspaceWidths.personal;
  elements.workWidthSelect.value = state.ui.workspaceWidths.team;

  elements.personalMoveBtn.textContent = order[0] === "personal" ? "העבר שמאלה" : "העבר ימינה";
  elements.workMoveBtn.textContent = order[0] === "team" ? "העבר שמאלה" : "העבר ימינה";
  applySectionView();
}

function renderStats() {
  if (!state.overview) {
    elements.stats.innerHTML = "";
    return;
  }

  const personalOpen = state.overview.personal.total - state.overview.personal.done;
  const workOpen = state.overview.team.total - state.overview.team.done;
  const allTotal = state.overview.personal.total + state.overview.team.total;

  const items = [
    { label: "פתוחות (אישי)", value: personalOpen },
    { label: "הושלמו (אישי)", value: state.overview.personal.done },
    { label: "פתוחות (עבודה)", value: workOpen },
    { label: "הושלמו (עבודה)", value: state.overview.team.done },
    { label: "סה״כ משימות", value: allTotal }
  ];

  elements.stats.innerHTML = items
    .map(
      (item) =>
        `<article class="stat-card"><p class="label">${escapeHtml(item.label)}</p><p class="value">${item.value}</p></article>`
    )
    .join("");
}

function taskTemplate(task) {
  const safeDescription = task.description ? escapeHtml(task.description) : "ללא תיאור";
  const goalPeriod = task.goalPeriod ?? "daily";
  const metaItems = [];
  const hasExplicitPriority = task.priority && task.priority !== "medium";

  if (hasExplicitPriority) {
    metaItems.push(`עדיפות: ${priorityLabels[task.priority] ?? task.priority}`);
  }

  if (task.dueDate) {
    metaItems.push(`יעד: ${formatDate(task.dueDate)}`);
  }

  const metaSection = metaItems.length
    ? `<div class="meta-row">${metaItems
        .map((item) => `<span class="meta-item">${escapeHtml(item)}</span>`)
        .join("")}</div>`
    : "";

  return `<article class="task-card${task.status === "done" ? " is-completed" : ""}" draggable="true" data-task-id="${escapeHtml(task.id)}" data-goal-period="${escapeHtml(goalPeriod)}">
    <div class="task-top">
      <input
        type="checkbox"
        class="quick-done-check"
        data-task-done-id="${escapeHtml(task.id)}"
        ${task.status === "done" ? "checked" : ""}
        aria-label="סימון משימה כבוצעה"
      />
      <div class="task-main">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <p class="task-description${task.description ? "" : " is-muted"}">${safeDescription}</p>
      </div>
      <div class="task-card-actions">
        <button type="button" class="quick-delete-btn" data-task-delete-id="${escapeHtml(task.id)}" aria-label="מחיקת משימה">
          מחק
        </button>
      </div>
    </div>
    ${metaSection}
    <div class="status-row">
      <label>
        סטטוס
        <select class="status-select" data-task-id="${escapeHtml(task.id)}">
          <option value="todo" ${task.status === "todo" ? "selected" : ""}>לביצוע</option>
          <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>בתהליך</option>
          <option value="done" ${task.status === "done" ? "selected" : ""}>הושלם</option>
        </select>
      </label>
      <span class="status-pill">${statusLabels[task.status] ?? task.status}</span>
    </div>
  </article>`;
}

function sortTasksForDisplay(tasks) {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === "done";
    const bDone = b.status === "done";

    if (aDone !== bDone) {
      return aDone ? 1 : -1;
    }

    if (!a.dueDate && !b.dueDate) {
      return a.title.localeCompare(b.title, "he");
    }

    if (!a.dueDate) {
      return 1;
    }

    if (!b.dueDate) {
      return -1;
    }

    return new Date(a.dueDate) - new Date(b.dueDate);
  });
}

function renderWorkspaceBoard(type, container, countElement) {
  const allWorkspaceTasks = state.tasks.filter((task) => workspaceById(task.workspaceId)?.type === type);
  const tasks = allWorkspaceTasks.filter((task) => state.ui.showCompletedTasks || task.status !== "done");
  const completedCount = allWorkspaceTasks.filter((task) => task.status === "done").length;
  const openCount = allWorkspaceTasks.length - completedCount;
  countElement.textContent = state.ui.showCompletedTasks
    ? `${openCount} פתוחות · ${completedCount} הושלמו`
    : `${openCount} משימות`;
  const goals = state.goalPeriods.length ? state.goalPeriods : defaultGoalPeriods;
  const workspaceId = findWorkspaceIdByType(type);

  container.innerHTML = goals
    .map((goalPeriod) => {
      const goalTasks = sortTasksForDisplay(tasks.filter((task) => (task.goalPeriod ?? "daily") === goalPeriod));
      const goalLabel = goalPeriodLabels[goalPeriod] ?? goalPeriod;
      const quickInputId = `quick-add-${type}-${goalPeriod}`;
      const isDaily = goalPeriod === "daily";
      const goalIsCollapsed = isGoalCollapsed(type, goalPeriod);
      const isDailyLimitReached = Boolean(workspaceId) && isDaily && goalTasks.length >= DAILY_GOAL_TASK_LIMIT;
      const isQuickAddDisabled = !workspaceId || isDailyLimitReached;
      const quickAddDisabled = isQuickAddDisabled ? "disabled" : "";
      const quickAddMessage = !workspaceId
        ? "לא נמצא מרחב זמין להוספה מהירה."
        : isDailyLimitReached
          ? `הגעת למקסימום ${DAILY_GOAL_TASK_LIMIT} משימות במטרה היומית.`
          : "";
      const goalTasksSummary = isDaily
        ? `${goalTasks.length}/${DAILY_GOAL_TASK_LIMIT} משימות`
        : `${goalTasks.length} משימות`;
      const goalToggleLabel = goalIsCollapsed ? "הצג" : "הסתר";
      const goalContentVisibilityClass = goalIsCollapsed ? "is-hidden" : "";
      const emptyMessage = state.ui.showCompletedTasks
        ? "אין משימות להצגה במטרה הזו."
        : "אין משימות פתוחות במטרה הזו.";

      return `
        <section class="category-group">
          <div class="category-group-head">
            <h3>
              ${escapeHtml(goalLabel)}
              <small>${goalTasksSummary}</small>
            </h3>
            <button
              type="button"
              class="goal-toggle-btn"
              data-goal-toggle="1"
              data-workspace-type="${escapeHtml(type)}"
              data-goal-period="${escapeHtml(goalPeriod)}"
              aria-expanded="${String(!goalIsCollapsed)}"
            >
              ${goalToggleLabel}
            </button>
          </div>
          <div class="goal-content ${goalContentVisibilityClass}">
            <form class="quick-add-form" data-workspace-type="${escapeHtml(type)}" data-goal-period="${escapeHtml(goalPeriod)}">
              <div class="quick-add-row">
                <input
                  id="${quickInputId}"
                  name="quickTitle"
                  type="text"
                  minlength="2"
                  placeholder="הקלד משימה חדשה..."
                  aria-label="הוספת משימה מהירה עבור ${escapeHtml(goalLabel)}"
                  ${quickAddDisabled}
                />
                <button type="submit" class="quick-add-btn" ${quickAddDisabled}>הוסף</button>
              </div>
              <p class="quick-add-feedback" role="status" aria-live="polite">${quickAddMessage}</p>
            </form>
            <div class="workspace-task-list">
              ${
                goalTasks.length
                  ? goalTasks.map(taskTemplate).join("")
                  : `<article class="empty-card"><p class="empty">${emptyMessage}</p></article>`
              }
            </div>
          </div>
        </section>
      `;
    })
    .join("");

}

function renderBoards() {
  renderWorkspaceBoard("personal", elements.personalWorkspace, elements.personalCount);
  renderWorkspaceBoard("team", elements.workWorkspace, elements.workCount);
  applyWorkspaceLayout();
  applyWorkspaceVisibility("personal");
  applyWorkspaceVisibility("team");
}

function clearWorkspaceDropTargets() {
  elements.personalPanel.classList.remove("drop-target");
  elements.workPanel.classList.remove("drop-target");
}

async function moveTaskToWorkspace(taskId, targetWorkspaceType) {
  const task = taskById(taskId);
  if (!task) {
    return;
  }

  const targetWorkspaceId = findWorkspaceIdByType(targetWorkspaceType);
  if (!targetWorkspaceId || targetWorkspaceId === task.workspaceId) {
    return;
  }

  const targetIsPersonal = targetWorkspaceType === "personal";
  const payload = {
    workspaceId: targetWorkspaceId,
    visibility: targetIsPersonal ? "private" : "workspace",
    assigneeId: targetIsPersonal ? state.user?.id ?? task.assigneeId : task.assigneeId ?? state.user?.id
  };

  await getJson(`/api/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = {};

  try {
    payload = await response.json();
  } catch {
    throw new Error("התקבלה תגובה לא תקינה מהשרת");
  }

  if (!response.ok) {
    throw new Error(payload.error || "הבקשה נכשלה");
  }

  return payload;
}

async function refreshTasks() {
  const response = await getJson("/api/tasks?scope=all");
  state.tasks = response.data;
  renderBoards();
}

async function refreshOverview() {
  const response = await getJson("/api/overview");
  state.overview = response.data;
  renderStats();
}

async function refreshCategories() {
  const response = await getJson("/api/categories");
  setCategories(response.data);
  refreshCategoryOptions();
}

async function bootstrap() {
  const payload = await getJson("/api/bootstrap");
  state.user = payload.user;
  state.workspaces = payload.workspaces;
  state.tasks = payload.tasks;
  state.overview = payload.overview;
  setCategories(payload.categories);
  setGoalPeriods(payload.goalPeriods);
  const savedLayout = readStoredLayout();
  if (savedLayout) {
    state.ui.workspaceCollapsed = savedLayout.workspaceCollapsed;
    state.ui.goalCollapsed = savedLayout.goalCollapsed;
    state.ui.workspaceOrder = savedLayout.workspaceOrder;
    state.ui.workspaceWidths = savedLayout.workspaceWidths;
    state.ui.currentSection = savedLayout.currentSection;
    state.ui.showCompletedTasks = savedLayout.showCompletedTasks;
  }

  elements.userGreeting.textContent = `שלום ${state.user.name}, זה מצב המשימות שלך כרגע.`;

  refreshWorkspaceOptions();
  refreshCategoryOptions();
  refreshGoalPeriodOptions();
  applyCompletedToggle();
  renderStats();
  renderBoards();
  applySectionView();
  setActiveSectionLink(state.ui.currentSection);
}

elements.workspaceSelect.addEventListener("change", () => {
  updateWorkspaceRuleHint();
});

elements.personalAddBtn.addEventListener("click", () => {
  openTaskMenu("personal");
});

elements.workAddBtn.addEventListener("click", () => {
  openTaskMenu("team");
});

elements.sidebarAddTaskBtn?.addEventListener("click", () => {
  openTaskMenu("personal");
});

elements.completedToggleBtn?.addEventListener("click", () => {
  state.ui.showCompletedTasks = !state.ui.showCompletedTasks;
  saveLayout();
  applyCompletedToggle();
  renderBoards();
});

elements.personalToggleBtn.addEventListener("click", () => {
  toggleWorkspaceCollapsed("personal");
});

elements.workToggleBtn.addEventListener("click", () => {
  toggleWorkspaceCollapsed("team");
});

elements.personalMoveBtn.addEventListener("click", () => {
  reverseWorkspaceOrder();
});

elements.workMoveBtn.addEventListener("click", () => {
  reverseWorkspaceOrder();
});

elements.personalWidthSelect.addEventListener("change", () => {
  setWorkspaceWidth("personal", elements.personalWidthSelect.value);
});

elements.workWidthSelect.addEventListener("change", () => {
  setWorkspaceWidth("team", elements.workWidthSelect.value);
});

elements.closeTaskMenuBtn.addEventListener("click", () => {
  closeTaskMenu();
});

elements.themeToggleBtn.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
  applyTheme(nextTheme);
});

elements.taskModalBackdrop.addEventListener("click", () => {
  closeTaskMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.taskModal.classList.contains("is-hidden")) {
    closeTaskMenu();
  }
});

elements.categorySuggestions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) {
    return;
  }

  elements.categoryInput.value = button.dataset.category || "";
  elements.categoryInput.focus();
});

elements.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.taskSubmitBtn.disabled = true;
  elements.taskSubmitBtn.textContent = "שומר...";

  const formData = new FormData(elements.taskForm);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    workspaceId: String(formData.get("workspaceId") || "").trim(),
    goalPeriod: String(formData.get("goalPeriod") || "daily"),
    priority: String(formData.get("priority") || "medium"),
    status: String(formData.get("status") || "todo")
  };

  if (payload.goalPeriod === "daily" && isDailyGoalLimitReached(payload.workspaceId)) {
    setFeedback(
      elements.taskFeedback,
      `ניתן ליצור עד ${DAILY_GOAL_TASK_LIMIT} משימות במטרה היומית לכל מרחב.`,
      "error"
    );
    elements.taskSubmitBtn.disabled = false;
    elements.taskSubmitBtn.textContent = "הוספת משימה";
    return;
  }

  const rawCategory = String(formData.get("category") || "").trim();
  const category = normalizeCategory(rawCategory);
  if (rawCategory && !category) {
    setFeedback(elements.taskFeedback, "קטגוריה חייבת להכיל לפחות 2 תווים.", "error");
    elements.taskSubmitBtn.disabled = false;
    elements.taskSubmitBtn.textContent = "הוספת משימה";
    return;
  }

  if (category) {
    payload.category = category;
  }

  const dueDate = String(formData.get("dueDate") || "").trim();
  if (dueDate) {
    payload.dueDate = dueDate;
  }

  try {
    await getJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    elements.taskForm.reset();
    refreshWorkspaceOptions();
    await Promise.all([refreshTasks(), refreshOverview(), refreshCategories()]);
    setFeedback(elements.taskFeedback, "המשימה נוספה בהצלחה.", "success");
    closeTaskMenu();
  } catch (error) {
    setFeedback(elements.taskFeedback, error.message, "error");
  } finally {
    elements.taskSubmitBtn.disabled = false;
    elements.taskSubmitBtn.textContent = "הוספת משימה";
  }
});

elements.workspaceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.workspaceSubmitBtn.disabled = true;
  elements.workspaceSubmitBtn.textContent = "יוצר...";

  const formData = new FormData(elements.workspaceForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    type: "team"
  };

  try {
    await getJson("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const workspaces = await getJson("/api/workspaces");
    state.workspaces = workspaces.data;
    refreshWorkspaceOptions();
    elements.workspaceForm.reset();
    await refreshTasks();
    setFeedback(elements.workspaceFeedback, "מרחב העבודה נוצר בהצלחה.", "success");
  } catch (error) {
    setFeedback(elements.workspaceFeedback, error.message, "error");
  } finally {
    elements.workspaceSubmitBtn.disabled = false;
    elements.workspaceSubmitBtn.textContent = "יצירת מרחב";
  }
});

elements.workspaceGrid.addEventListener("change", async (event) => {
  const doneCheckbox = event.target.closest("input[data-task-done-id]");
  if (doneCheckbox) {
    const taskId = doneCheckbox.dataset.taskDoneId;
    if (!taskId) {
      return;
    }

    const nextStatus = doneCheckbox.checked ? "done" : "todo";
    doneCheckbox.disabled = true;

    try {
      await getJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });

      await Promise.all([refreshTasks(), refreshOverview()]);
      setFeedback(elements.taskFeedback, nextStatus === "done" ? "המשימה סומנה כבוצעה." : "הסימון בוצע.");
    } catch (error) {
      if (doneCheckbox.isConnected) {
        doneCheckbox.checked = !doneCheckbox.checked;
      }
      setFeedback(elements.taskFeedback, error.message, "error");
    } finally {
      if (doneCheckbox.isConnected) {
        doneCheckbox.disabled = false;
      }
    }
    return;
  }

  const select = event.target.closest("select[data-task-id]");
  if (!select) {
    return;
  }

  try {
    await getJson(`/api/tasks/${select.dataset.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: select.value })
    });

    await Promise.all([refreshTasks(), refreshOverview()]);
    setFeedback(elements.taskFeedback, "הסטטוס עודכן.", "success");
  } catch (error) {
    setFeedback(elements.taskFeedback, error.message, "error");
  }
});

elements.workspaceGrid.addEventListener("submit", async (event) => {
  const form = event.target.closest("form.quick-add-form");
  if (!form) {
    return;
  }

  event.preventDefault();

  const input = form.querySelector('input[name="quickTitle"]');
  const submitButton = form.querySelector("button[type='submit']");
  if (!input || !submitButton) {
    return;
  }

  const title = String(input.value || "").trim();
  if (title.length < 2) {
    setQuickAddFeedback(form, "יש להזין לפחות 2 תווים.", "error");
    input.focus();
    return;
  }

  const workspaceType = form.dataset.workspaceType === "team" ? "team" : "personal";
  const workspaceId = findWorkspaceIdByType(workspaceType);
  if (!workspaceId) {
    setQuickAddFeedback(form, "אין מרחב זמין להוספה מהירה.", "error");
    return;
  }

  const goalPeriod = form.dataset.goalPeriod ?? "daily";
  const defaultCategory = workspaceType === "team" ? "עבודה" : "אישי";

  if (goalPeriod === "daily" && isDailyGoalLimitReached(workspaceId)) {
    setQuickAddFeedback(form, `הגעת למקסימום ${DAILY_GOAL_TASK_LIMIT} משימות במטרה היומית.`, "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "מוסיף...";
  setQuickAddFeedback(form, "");

  try {
    await getJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: "",
        workspaceId,
        goalPeriod,
        priority: "medium",
        status: "todo",
        category: defaultCategory
      })
    });

    input.value = "";
    await Promise.all([refreshTasks(), refreshOverview(), refreshCategories()]);
    setFeedback(elements.taskFeedback, "המשימה נוספה במהירות.", "success");
  } catch (error) {
    setQuickAddFeedback(form, error.message, "error");
  } finally {
    if (submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = "הוסף";
    }
  }
});

elements.workspaceGrid.addEventListener("click", async (event) => {
  const goalToggleButton = event.target.closest("button[data-goal-toggle]");
  if (goalToggleButton) {
    const workspaceType = goalToggleButton.dataset.workspaceType === "team" ? "team" : "personal";
    const goalPeriod = goalToggleButton.dataset.goalPeriod;
    if (!goalPeriodLabels[goalPeriod]) {
      return;
    }

    toggleGoalCollapsed(workspaceType, goalPeriod);
    return;
  }

  const deleteButton = event.target.closest("button[data-task-delete-id]");
  if (!deleteButton) {
    return;
  }

  const taskId = deleteButton.dataset.taskDeleteId;
  if (!taskId) {
    return;
  }

  const previousText = deleteButton.textContent;
  deleteButton.disabled = true;
  deleteButton.textContent = "מוחק...";

  try {
    await getJson(`/api/tasks/${taskId}`, { method: "DELETE" });
    await Promise.all([refreshTasks(), refreshOverview(), refreshCategories()]);
    setFeedback(elements.taskFeedback, "המשימה נמחקה.", "success");
  } catch (error) {
    setFeedback(elements.taskFeedback, error.message, "error");
  } finally {
    if (deleteButton.isConnected) {
      deleteButton.disabled = false;
      deleteButton.textContent = previousText;
    }
  }
});

elements.workspaceGrid.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".task-card[data-task-id]");
  if (!card) {
    return;
  }

  state.ui.draggingTaskId = card.dataset.taskId ?? null;
  card.classList.add("is-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", state.ui.draggingTaskId ?? "");
  }
});

elements.workspaceGrid.addEventListener("dragend", (event) => {
  const card = event.target.closest(".task-card[data-task-id]");
  if (card) {
    card.classList.remove("is-dragging");
  }

  state.ui.draggingTaskId = null;
  clearWorkspaceDropTargets();
});

[elements.personalPanel, elements.workPanel].forEach((panel) => {
  panel.addEventListener("dragover", (event) => {
    if (!state.ui.draggingTaskId) {
      return;
    }

    event.preventDefault();
    panel.classList.add("drop-target");
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });

  panel.addEventListener("dragleave", (event) => {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !panel.contains(nextTarget)) {
      panel.classList.remove("drop-target");
    }
  });

  panel.addEventListener("drop", async (event) => {
    if (!state.ui.draggingTaskId) {
      return;
    }

    event.preventDefault();
    const draggedTaskId = state.ui.draggingTaskId;
    const targetWorkspaceType = panel.dataset.workspaceType === "team" ? "team" : "personal";

    clearWorkspaceDropTargets();

    try {
      await moveTaskToWorkspace(draggedTaskId, targetWorkspaceType);
      await Promise.all([refreshTasks(), refreshOverview()]);
      setFeedback(elements.taskFeedback, "המשימה הועברה בין מרחבים.", "success");
    } catch (error) {
      setFeedback(elements.taskFeedback, error.message, "error");
    } finally {
      state.ui.draggingTaskId = null;
    }
  });
});

applyTheme(getInitialTheme(), { persist: false });
initSectionNavigation();

bootstrap().catch((error) => {
  setFeedback(elements.taskFeedback, `טעינת המערכת נכשלה: ${error.message}`, "error");
});
