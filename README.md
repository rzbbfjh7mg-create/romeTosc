# Dual Mode Task Manager

Starter implementation of a task manager that supports both personal and team workflows in one app.

## What is included
- Node.js API server (no external dependencies)
- Dual-mode data model: `personal` + `team` workspaces
- Task management endpoints and business rules
- Browser UI for creating/updating tasks and team workspaces
- Basic automated tests with Node test runner

## Run locally
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

By default, local runs now persist tasks to:
- `data/tasks-db.json`

## Development mode
```bash
npm run dev
```

## Run tests
```bash
npm test
```

## Data persistence
- `PERSIST_DATA=true` enables saving data to disk.
- `APP_DATA_FILE=/path/to/tasks-db.json` controls where data is saved.
- In `npm start`, persistence is enabled by default.
- Tasks are never auto-deleted; removal happens only through the explicit delete action/API.

## Deploy as a website
- Render blueprint file is included: `render.yaml`
- Docker deployment file is included: `Dockerfile`
- Full deploy steps: `docs/DEPLOY.md`

## Run as an iPhone app (Capacitor)
This project now includes a native iOS wrapper in `ios/`.

1. Make sure your production site is live over HTTPS.
2. Verify `server.url` in `capacitor.config.json` points to your live domain.
3. Sync web assets + config:
```bash
npm run cap:sync
```
4. Open Xcode:
```bash
npm run ios:open
```
5. In Xcode, set Signing Team and Bundle Identifier, then run on simulator/device.

Detailed guide: `docs/IOS_APP.md`

## Project structure
- `src/store.js`: core domain model + validation rules
- `src/server.js`: API routes + static server
- `public/`: frontend UI files
- `docs/PRODUCT_PLAN.md`: product and technical plan
- `docs/IOS_APP.md`: iOS wrapper build/release guide
- `test/api.test.js`: API behavior tests

## Personal vs Team rules in this version
- Every user has a personal workspace.
- New workspaces from UI are team workspaces.
- Personal tasks are always private.
- Personal tasks can only be assigned to the current user.
