---
'@company-of-heroes/ui': minor
'@company-of-heroes/app': minor
'@company-of-heroes/website': minor
'@company-of-heroes/api': patch
---

refactor; the desktop app and website now render the same components from `@company-of-heroes/ui` (player profile, likes, comments, replay detail/upload/edit, leaderboards, live lobbies, profile form). Shared components translate themselves and reach host features through one host context, so a change is made in one place. The app profile now shows the player's level, the website performance panel translates "Games", website match history dates follow the page language, and the website upload, replay edit and profile forms save without a full page reload.
