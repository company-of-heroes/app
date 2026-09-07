---
'@company-of-heroes/app': minor
'@company-of-heroes/landing': minor
'@company-of-heroes/ui': minor
'@company-of-heroes/api': minor
'@company-of-heroes/pocketbase': minor
'@company-of-heroes/i18n': patch
---

feat; add member replay uploads with compose preview, ladder-stats snapshots, and per-player Steam ID linking when missing from the .rec
feat; owners can edit member replay title, description, and Steam links, and soft-delete uploads (hidden from public; retained for staff)
feat; require a description on member replay upload, edit, and publish-from-match
enhance; drag-and-drop .rec file picker on member replay upload
fix; parse .rec files in a worker and return slim results (no action dump) so the UI stays responsive
fix; wire mention user search on member replay descriptions and anchor the popup above the @
enhance; open member replay upload as a full page in the app (same flow as the website)
enhance; show member replay details in the app with the same header layout as the website
fix; render member replay descriptions as markdown (bold, mentions) on detail pages
enhance; share member replay detail header between app and website
enhance; add up/down votes on member replays like match likes
feat; add comments on member replays
enhance; hide Screenshots tab on member replay detail (uploads have none)
fix; align app replay detail loading skeleton with the website layout
feat; publish an owned community match as a member replay (leaves Community matches; stays under My matches)
