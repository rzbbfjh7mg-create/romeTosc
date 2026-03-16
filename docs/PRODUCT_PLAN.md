# Dual-Mode Task Manager Plan (Personal + Team)

## 1. Product direction
- Build one product with two native modes: `Personal Space` and `Team Workspace`.
- Keep a shared inbox and UX shell, but enforce different collaboration rules by workspace type.
- Personal mode prioritizes speed and privacy; team mode prioritizes visibility and accountability.

## 2. Primary outcomes
- Personal users can capture and complete tasks quickly, with low UI friction.
- Teams can coordinate work with ownership, status clarity, and progress tracking.
- Users who work in both contexts do not need separate tools.

## 3. Scope for initial build
- Workspace model with `personal` and `team` types.
- Task CRUD with fields: title, description, status, priority, due date, workspace.
- Scope filtering: all, personal, team.
- Rule engine:
  - Personal task visibility stays `private`.
  - Personal tasks cannot be assigned to others.
- Team workspace creation from UI.
- Dashboard overview with personal/team totals and done counts.

## 4. Architecture choice
- Runtime: Node.js, no external dependencies.
- Backend: built-in HTTP server with JSON API.
- Data layer: in-memory store (replaceable later by DB repository).
- Frontend: static HTML/CSS/JS served by the same Node process.
- Tests: Node built-in test runner.

## 5. API contract (v0)
- `GET /api/bootstrap` -> user + workspaces + tasks + overview.
- `GET /api/workspaces` -> list all workspaces.
- `POST /api/workspaces` -> create team workspace.
- `GET /api/tasks?scope=all|personal|team` -> tasks by scope.
- `POST /api/tasks` -> create task.
- `PATCH /api/tasks/:id` -> update task state/fields.
- `GET /api/overview` -> dual-mode counters.

## 6. Next implementation phases
- Persist data in PostgreSQL with migration support.
- Add authentication and RBAC for multi-user team workspaces.
- Add comments, mentions, activity log.
- Add calendar view and recurring tasks.
- Add notification jobs (email/push) for due dates and mentions.

## 7. Acceptance criteria for current milestone
- User can create tasks in both workspace types.
- User can filter inbox by personal/team/all.
- User can update task status from UI.
- Business rules reject invalid personal-task sharing behavior.
- App runs locally via one command and passes API behavior tests.
