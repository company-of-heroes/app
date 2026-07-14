# Deploying coh1stats.com (Cloudflare Pages)

The landing page lives in `packages/landing` and builds to `dist/`.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/) with `coh1stats.com` in your zone
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated (`wrangler login`)

## Build locally

From the repo root:

```bash
pnpm install
pnpm landing:build
```

Output: `packages/landing/dist/`

## Deploy with Wrangler

From `packages/landing`:

```bash
wrangler pages deploy dist --project-name=coh1stats-landing
```

On first deploy, Wrangler creates the Pages project. Config is in [`wrangler.toml`](./wrangler.toml).

## Custom domain

In the Cloudflare dashboard:

1. **Workers & Pages** → **coh1stats-landing** → **Custom domains**
2. Add `coh1stats.com` and `www.coh1stats.com`
3. Cloudflare adds the required DNS records automatically if the zone is on Cloudflare

The API stays on `api.coh1stats.com` (PocketBase). Do not serve the landing page from the API host.

## CI (optional)

No GitHub Action exists yet. A typical workflow would:

1. Trigger on push to `master` when `packages/landing/**` or `packages/shared-assets/**` changes
2. Run `pnpm install` and `pnpm landing:build`
3. Run `wrangler pages deploy packages/landing/dist --project-name=coh1stats-landing`

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.

## Preview locally

```bash
pnpm landing:dev
```

Dev server: http://localhost:5174

## SPA routing

Cloudflare Pages serves [`public/_redirects`](public/_redirects) so client routes like `/card` and `/card/{steamId}` fall back to `index.html`.

For local player card API testing, set `VITE_API_URL=http://127.0.0.1:8090` when PocketBase runs locally and `STEAM_API_KEY` is configured for the PocketBase container.
