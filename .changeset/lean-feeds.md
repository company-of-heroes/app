---
'@company-of-heroes/app': patch
'@company-of-heroes/ui': patch
'@company-of-heroes/website': patch
'@company-of-heroes/api-gateway': patch
'@company-of-heroes/oppbot-overlay': patch
'@company-of-heroes/smurf-worker': patch
---

improvement; far fewer API requests: live lobbies and the OBS overlay follow realtime instead of polling, comments and likes no longer reload while a match waits for its result, the app checks for updates every hour (installing only outside a match), and the website and smurf worker can reach PocketBase without passing the api-gateway
