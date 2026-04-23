# Deploy Guide

This itinerary site now runs as a single Node.js service that serves the HTML page and saves trip changes to a JSON file on disk.

## Persistent trip data

Trip changes are persisted to disk when:
- `PERSIST_DATA=true`
- `TRIP_DATA_FILE` points to a writable path, for example `/var/data/roma-toscana-2026.json`

Use a provider volume or persistent disk so itinerary edits survive redeploys and restarts.

## Option A: Render (recommended)

This repository includes a ready-to-use `render.yaml` for the trip site.

1. Push the project to GitHub.
2. In Render, create a new Blueprint and select this repo.
3. Render will create:
- One Node web service
- One persistent disk mounted at `/var/data`
4. Deploy.

Production will run:
- `npm run trip:start`

Trip edits will be saved to:
- `/var/data/roma-toscana-2026.json`

## Option B: Any Node host or VPS

Run the trip server directly:

```bash
PORT=8000 \
PERSIST_DATA=true \
TRIP_DATA_FILE=/var/data/roma-toscana-2026.json \
node src/trip-server.js
```

Then expose that port through your host, reverse proxy, or platform router.

## Option C: Docker host

Build and run:

```bash
docker build -t roma-toscana-2026 .
docker run -p 8000:8000 \
  -e PORT=8000 \
  -e PERSIST_DATA=true \
  -e TRIP_DATA_FILE=/var/data/roma-toscana-2026.json \
  -v $(pwd)/data:/var/data \
  roma-toscana-2026 \
  node src/trip-server.js
```

The bind mount (or named volume) ensures itinerary edits are kept.
