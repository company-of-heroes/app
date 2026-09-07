---
'@company-of-heroes/app': patch
'@company-of-heroes/api': patch
---

fix; skip lobbies_live upserts when only replay placeholders are present so PocketBase does not reject empty players
