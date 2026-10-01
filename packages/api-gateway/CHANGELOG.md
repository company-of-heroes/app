# @company-of-heroes/api-gateway

## 0.2.0

- feat; serve legacy api.coh1stats.com routes from the website, OBS overlays from R2, and rate-limit replay downloads
- security; steam ids are linked only when no other account owns them (staff resolve conflicts), match results and ratings come only from Relic, emails no longer leak in expanded records, overlays move to overlay.coh1stats.com, and the desktop app refreshes its session, sanitizes notifications and no longer ships the Steam API key
