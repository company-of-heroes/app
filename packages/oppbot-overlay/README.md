# Opponent Bot Overlay

Customize this overlay for your stream. The app publishes only the `dist/` folder to your hosted URL.

## Setup (once)

```bash
npm install
```

## Customize and build

1. Edit files in `src/` (Svelte components, CSS, etc.)
2. Build after each change:

```bash
npm run build
```

3. In the app: **Twitch → Overlays → Publish changes to server**

## Preview locally

Start the overlay dev server (not the desktop app):

```bash
pnpm overlays:dev
```

Open http://localhost:5173/ — test lobbies for 1v1, 2v2, 3v3 and 4v4 appear automatically. Use the buttons at the bottom-right to switch scenarios, or `?dev=2v2` in the URL.

The desktop app (`pnpm run dev` on port 1420) is a separate project and does not show overlay test data.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer

Without Node.js you can still publish the included default `dist/` build from the app.
