# iOS App Guide (Capacitor)

This project can be released as a real iPhone app while keeping the same backend and DB used by the website.

## What was added
- Capacitor dependencies in `package.json`
- Capacitor config in `capacitor.config.json`
- Native iOS project under `ios/`

## Current production URL
The iOS wrapper is configured to load:

`https://dual-mode-task-manager.onrender.com`

If your production domain is different, update `capacitor.config.json` (`server.url`) and run sync again.

## Prerequisites
- macOS with Xcode installed
- Apple Developer account (required for TestFlight / App Store release)
- Node.js + npm

## First-time setup
Install dependencies:

```bash
npm install
```

If `ios/` does not exist yet:

```bash
npm run cap:add:ios
```

## Daily workflow
After frontend/config changes:

```bash
npm run cap:sync
```

Open in Xcode:

```bash
npm run ios:open
```

## Xcode release flow
1. Select `App` target.
2. Set `Signing & Capabilities` Team.
3. Set a unique Bundle Identifier (for example: `com.yourcompany.tasks`).
4. Set version/build number in target settings.
5. Product -> Archive.
6. Distribute through TestFlight / App Store Connect.

## Data persistence behavior
- Tasks are stored in your backend DB (server-side), not deleted automatically.
- The iPhone app and website both use the same persisted task data through the production API.
