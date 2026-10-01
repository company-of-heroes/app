---
'@company-of-heroes/app': patch
'@company-of-heroes/api': patch
'@company-of-heroes/api-gateway': patch
'@company-of-heroes/pocketbase': patch
'@company-of-heroes/website': patch
'@company-of-heroes/jobs-worker': patch
'@company-of-heroes/i18n': patch
---

security; steam ids are linked only when no other account owns them (staff resolve conflicts), match results and ratings come only from Relic, emails no longer leak in expanded records, overlays move to overlay.coh1stats.com, and the desktop app refreshes its session, sanitizes notifications and no longer ships the Steam API key
