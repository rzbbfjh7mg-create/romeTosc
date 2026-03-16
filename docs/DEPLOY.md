# Deploy Guide

This app includes both frontend and API in one Node.js server, so deployment is a single service.

## Persistent tasks

Task data is persisted to disk when:
- `PERSIST_DATA=true` (default in production startup)
- `APP_DATA_FILE` points to a writable path (for example: `/var/data/tasks-db.json`)

Use a provider volume/disk mount so data survives restarts and redeploys.

## Option A: Render (recommended)

This repository includes `render.yaml`.

1. Push the project to GitHub.
2. In Render, create a new Blueprint and select this repo.
3. Render will create:
- One web service
- One persistent disk mounted at `/var/data`
4. Deploy.

After deployment, tasks are saved in `/var/data/tasks-db.json`.

## Option B: Any Docker host

Build and run:

```bash
docker build -t dual-mode-task-manager .
docker run -p 3000:3000 \
  -e PERSIST_DATA=true \
  -e APP_DATA_FILE=/var/data/tasks-db.json \
  -v $(pwd)/data:/var/data \
  dual-mode-task-manager
```

The bind mount (or named volume) ensures tasks are kept.
