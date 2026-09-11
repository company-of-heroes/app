![Company of Heroes - Companion](packages/app/static/fknoobs-app-banner.png)

**Company of Heroes - Companion** is a free desktop app for **Company of Heroes**. It runs alongside the game and adds replay analysis, match history, player lookup, leaderboards, custom keybindings, and Twitch streaming tools — all in one place.

Built with **Tauri**, **SvelteKit**, and **PocketBase**.

> [!WARNING]
> **Work in progress:** the app is actively developed. Expect changes, incomplete features, and the occasional bug.

## Download & install

**Latest release:** https://github.com/fknoobs/app/releases/latest

Skip “Source code (zip/tar.gz)” unless you want to build it yourself.

### Windows

Grab the **Windows installer** — the `.exe` named like `fknoobscoh_<version>_x64-setup.exe`.

1. **Download** the installer from the [latest release](https://github.com/fknoobs/app/releases/latest) page
2. If your **browser** warns you (“This file may not be safe”) → click **Keep** / **Download anyway**
3. **Run** the `.exe` you just downloaded
4. Follow the installer — pick your shortcut, finish setup
5. Launch **Company of Heroes - Companion** from the Start Menu or desktop shortcut

> [!IMPORTANT]
> **Code signing:** Official Windows builds from GitHub Releases are **Authenticode-signed** via [Azure Artifact Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/). Windows shows a known publisher when you install. Built by [Code IT](https://codeit.ninja) ([GitHub](https://github.com/codeit-ninja), [Twitch](https://www.twitch.tv/fknoobscoh)). Always download from the releases link above — not from third-party mirrors.
>
> **Microsoft Store from v1.0:** From version 1.0 onwards, **Company of Heroes - Companion** will be published on the Microsoft Store. Until then, grab pre-1.0 builds from GitHub releases above.

### Linux

Grab the **AppImage** — the file named like `fknoobscoh_<version>_amd64.AppImage`.

1. **Download** the AppImage from the [latest release](https://github.com/fknoobs/app/releases/latest) page
2. Make it executable: `chmod +x fknoobscoh_*.AppImage`
3. Install **WebKitGTK 4.1** if it is not already present (Debian/Ubuntu: `sudo apt install libwebkit2gtk-4.1-0`)
4. Run the AppImage

In-game features (log watching, keybindings, screenshots) are Windows-only. Match history, leaderboards, player lookup, and stream overlays still work on Linux.

## Features

Everything you need between games — no alt-tab chaos.

<table>
  <tr>
    <td width="50%" valign="top">

**Dashboard**  
Your command center. Live lobbies, recent matches, and quick links into every part of the app.

</td>
    <td width="50%" valign="top">

**Replays**  
Your replays and the community catalog in one place. Browse, filter, and open any match for details, chat logs, and analysis.

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

**Keybindings**  
Custom shortcuts per faction — USA, Brits, Wehrmacht, Panzer Elite. Record, drag to reorder, export & import.

</td>
    <td width="50%" valign="top">

**Leaderboards**  
Relic leaderboards by mode and faction. Search players, see the podium, climb the ranks.

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

**Players**  
Look anyone up by name, Steam ID, or Relic profile. Profiles with match history and stats included.

</td>
    <td width="50%" valign="top">

**Live game**  
Lobby started? The app notices. Jump into a live match view and save it when the game ends.

</td>
  </tr>
  <tr>
    <td colspan="2" valign="top">

**Twitch**  
Connect your channel and stream with purpose:
- **TTS** — chat read aloud (ElevenLabs, StreamElements, …)
- **Bot** — commands and moderation helpers
- **Overlays** — OBS-ready Opponent Bot overlay hosted on api.coh1stats.com

</td>
  </tr>
</table>

Auto-updates with changelog · Account sync · Discord, Twitch & GitHub in the sidebar

## Screenshots

<table>
  <tr>
    <td width="50%" align="center">

**Dashboard**  
![Dashboard](packages/shared-assets/screens/dashboard.png)

</td>
    <td width="50%" align="center">

**Replays**  
![Replays](packages/shared-assets/screens/replays.png)

</td>
  </tr>
  <tr>
    <td width="50%" align="center">

**Keybindings**  
![Keybindings](packages/shared-assets/screens/keybindings.png)

</td>
    <td width="50%" align="center">

**Leaderboards**  
![Leaderboards](packages/shared-assets/screens/leaderboards.png)

</td>
  </tr>
  <tr>
    <td width="50%" align="center">

**Players**  
![Players](packages/shared-assets/screens/players.png)

</td>
    <td width="50%" align="center">

**Twitch**  
![Twitch](packages/shared-assets/screens/twitch.png)

</td>
  </tr>
</table>

---

## Development

This is a **pnpm + Turbo monorepo**. Packages:

| Package | Role |
|---|---|
| `packages/app` | Tauri desktop app (SvelteKit, adapter-static) |
| `packages/website` | Public site [coh1stats.com](https://coh1stats.com) (Cloudflare) |
| `packages/ui` | Shared presentational UI |
| `packages/api` | Shared PocketBase / API client (`createApi`) |
| `packages/i18n` | Shared `en` / `es` / `ko` dictionaries |
| `packages/pocketbase` | Local API (Docker), schema migrations, hooks |
| `packages/oppbot-overlay` | Opponent Bot overlay source |
| `packages/smurf-worker` | Cloudflare Worker for smurf scoring |
| `packages/shared-assets` | Screenshots and static assets |

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)
- [Docker](https://www.docker.com/) (for local PocketBase)

### Run locally

From the repo root:

```bash
pnpm install
pnpm dev
```

This starts PocketBase on `http://localhost:8090` and launches the Tauri dev window. PocketBase data is stored in `packages/pocketbase/pb_data`.

Website (separate from the desktop app):

```bash
pnpm website:dev
```

### Environment

Copy `packages/app/.env.example` to `packages/app/.env` and set:

```env
PUBLIC_PB_URL=http://127.0.0.1:8090
```

Use `127.0.0.1` rather than `localhost` on Windows (IPv6 / Docker). When `PUBLIC_PB_URL` is not set, the app falls back to the production API at `https://api.coh1stats.com`. Production builds load `packages/app/.env.production`.

### PocketBase commands

```bash
pnpm pb:up                           # start PocketBase (Docker)
pnpm pb:down                         # stop PocketBase
pnpm --filter app pocketbase:typegen # regenerate TypeScript types after schema changes
```

Optionally create an admin user at `http://localhost:8090/_/`.

### Build

```bash
pnpm build              # production Tauri build (Windows)
pnpm website:build      # production website build
```

Platform-specific desktop builds:

```bash
pnpm --filter app tauri:build:windows
pnpm --filter app tauri:build:macos
pnpm --filter app tauri:build:linux
```

### Notes

- `packages/pocketbase/pb_data` is gitignored.
- OppBot overlay: `pnpm overlays:dev` / `pnpm overlays:build` (copies into PocketBase public). Do not hand-edit hashed files under `packages/pocketbase/pb_hooks/public/overlay-default/`.

---

### Maintained by

Richard Mauritz — [richard@codeit.ninja](mailto:richard@codeit.ninja)
