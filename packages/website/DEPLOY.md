# Deploying coh1stats.com (Cloudflare Workers)

The website is a **SvelteKit** app in `packages/website` with `@sveltejs/adapter-cloudflare`.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/) with `coh1stats.com` in your zone
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated (`wrangler login`)

## Build locally

From the repo root:

```bash
pnpm install
pnpm website:build
```

Output: `packages/website/.svelte-kit/cloudflare/`

## Deploy with Wrangler

From `packages/website`:

```bash
pnpm deploy
```

This runs `vite build && wrangler deploy` using [`wrangler.toml`](./wrangler.toml) (`main = ".svelte-kit/cloudflare/_worker.js"`).

## Custom domain

In the Cloudflare dashboard:

1. **Workers & Pages** → **coh1stats-website** → **Settings** → **Domains & Routes**
2. Add `coh1stats.com` and `www.coh1stats.com`

The API stays on `api.coh1stats.com` (PocketBase). Do not serve the website from the API host.

### First deploy after rename from `coh1stats-landing`

Changing `name` in `wrangler.toml` creates a **new** Worker script; it does not rename the old one in place.

1. Deploy so `coh1stats-website` exists (`pnpm website:build` then `pnpm --filter @company-of-heroes/website deploy`).
2. Move `coh1stats.com` / `www.coh1stats.com` from `coh1stats-landing` to `coh1stats-website` (or add on the new Worker, then remove from the old).
3. Copy any Worker vars/secrets (`PUBLIC_API_URL`, `REPLAY_PROXY_SECRET`, …) onto `coh1stats-website` if they did not transfer.
4. Delete or disable `coh1stats-landing` once the new Worker is healthy.

Until domains are moved, the old Worker keeps serving production traffic.

## CI

[`.github/workflows/deploy-cloudflare.yml`](../../.github/workflows/deploy-cloudflare.yml) deploys on every push to `master`, only what changed:

| Target | Deploys when these change |
| --- | --- |
| `coh1stats-website` | `packages/website`, `ui`, `api`, `i18n`, `game-data`, `shared-assets`, app map images, `POLICY.md`, `pnpm-lock.yaml` |
| `coh1stats-api-gateway` | `packages/api-gateway` (incl. the built `overlay-default/`) |
| `coh1stats-jobs-worker` | `packages/jobs-worker` |
| `fknoobs-smurf-worker` | `packages/smurf-worker` |

The website deploys first; the workers follow (they bind to it). Run the workflow manually (**Actions → Deploy Cloudflare → Run workflow**) to deploy one target or all of them.

Repository secrets:

- `CLOUDFLARE_API_TOKEN`: **Edit Cloudflare Workers** template, plus **Workers R2 Storage: Edit** (account) and **Workers KV Storage: Edit** (account), zone `coh1stats.com` for the gateway routes
- `CLOUDFLARE_ACCOUNT_ID`

Worker secrets (`wrangler secret put`) stay in Cloudflare; a deploy does not touch them.

## Preview locally

Dev server:

```bash
pnpm website:dev
```

http://localhost:5174

Production-like preview (after build):

```bash
pnpm --filter @company-of-heroes/website preview
```

## Environment variables

| Variable                 | Where                                                   | Purpose                                                                                             |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PUBLIC_API_URL`         | `.env` / Cloudflare Worker vars                         | PocketBase API base URL (default: `https://api.coh1stats.com`)                                      |
| `REPLAY_PROXY_SECRET`    | PocketBase `.env` and Cloudflare Worker vars (optional) | Shared secret so the website can fetch replay files without sharing one IP quota with every visitor |
| `YOUTUBE_CLIENT_ID`      | Cloudflare Worker secrets                               | Google OAuth web client for desktop YouTube connect (Streaming)                                     |
| `YOUTUBE_CLIENT_SECRET`  | Cloudflare Worker secrets                               | Google OAuth client secret (never ship in the desktop app)                                          |
| `AUTH_HANDOFF_SECRET`    | Cloudflare Worker secrets                               | Signs Steam login handoff codes and YouTube OAuth state / token handoff                             |

For local player card API testing, create `packages/website/.env`:

```
PUBLIC_API_URL=http://127.0.0.1:8090
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
AUTH_HANDOFF_SECRET=
```

Google Cloud Console: create a **Web application** OAuth client. Authorized redirect URIs must include:

- `https://coh1stats.com/api/v1/streaming/youtube/callback`
- `http://127.0.0.1:5174/api/v1/streaming/youtube/callback` (local website)

PocketBase must have `STEAM_API_KEY` configured for the player card endpoint.
