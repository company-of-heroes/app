# Deploying coh1stats.com (Cloudflare Workers)

The landing site is a **SvelteKit** app in `packages/landing` with `@sveltejs/adapter-cloudflare`.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/) with `coh1stats.com` in your zone
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated (`wrangler login`)

## Build locally

From the repo root:

```bash
pnpm install
pnpm landing:build
```

Output: `packages/landing/.svelte-kit/cloudflare/`

## Deploy with Wrangler

From `packages/landing`:

```bash
pnpm deploy
```

This runs `wrangler deploy` using [`wrangler.toml`](./wrangler.toml) (`main = ".svelte-kit/cloudflare/_worker.js"`).

## Custom domain

In the Cloudflare dashboard:

1. **Workers & Pages** → **coh1stats-landing** → **Settings** → **Domains & Routes**
2. Add `coh1stats.com` and `www.coh1stats.com`

The API stays on `api.coh1stats.com` (PocketBase). Do not serve the landing page from the API host.

## CI (optional)

A typical workflow would:

1. Trigger on push to `master` when `packages/landing/**` or `packages/shared-assets/**` changes
2. Run `pnpm install` and `pnpm landing:build`
3. Run `pnpm --filter @company-of-heroes/landing deploy`

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.

## Preview locally

Dev server:

```bash
pnpm landing:dev
```

http://localhost:5174

Production-like preview (after build):

```bash
pnpm --filter @company-of-heroes/landing preview
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `PUBLIC_API_URL` | `.env` / Cloudflare Worker vars | PocketBase API base URL (default: `https://api.coh1stats.com`) |

For local player card API testing, create `packages/landing/.env`:

```
PUBLIC_API_URL=http://127.0.0.1:8090
```

PocketBase must have `STEAM_API_KEY` configured for the player card endpoint.
