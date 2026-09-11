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

## CI (optional)

A typical workflow would:

1. Trigger on push to `master` when `packages/website/**` or `packages/shared-assets/**` changes
2. Run `pnpm install` and `pnpm website:build`
3. Run `pnpm --filter @company-of-heroes/website deploy`

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.

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

| Variable | Where | Purpose |
|----------|-------|---------|
| `PUBLIC_API_URL` | `.env` / Cloudflare Worker vars | PocketBase API base URL (default: `https://api.coh1stats.com`) |
| `REPLAY_PROXY_SECRET` | PocketBase `.env` and Cloudflare Worker vars (optional) | Shared secret so the website can fetch replay files without sharing one IP quota with every visitor |

For local player card API testing, create `packages/website/.env`:

```
PUBLIC_API_URL=http://127.0.0.1:8090
```

PocketBase must have `STEAM_API_KEY` configured for the player card endpoint.
