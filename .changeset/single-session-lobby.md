---
'@company-of-heroes/website': patch
'@company-of-heroes/pocketbase': patch
'@company-of-heroes/jobs-worker': patch
---

fix; players who start the same match at the same moment no longer save it twice; a second report fills in what the saved match is still missing, and matches already saved twice are merged into one
