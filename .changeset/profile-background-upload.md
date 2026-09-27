---
'@company-of-heroes/app': patch
'@company-of-heroes/website': patch
'@company-of-heroes/api': patch
'@company-of-heroes/pocketbase': patch
---

fix; upload profile backgrounds as base64 instead of multipart (avoids PocketBase temp-file races)
