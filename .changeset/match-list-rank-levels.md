---
'@company-of-heroes/app': patch
'@company-of-heroes/website': patch
'@company-of-heroes/ui': patch
'@company-of-heroes/api': patch
'@company-of-heroes/pocketbase': patch
'@company-of-heroes/shared-assets': patch
---

enhance; show player rank and level in community and member match lists
enhance; use shared rank assets and show unranked badge when level is missing
enhance; show match roster as compact rank chips instead of bordered tiles
enhance; enlarge match-list rank and faction icons for readability
fix; never show rank badges on Basic Match / unranked rows (faction flags only)
fix; drop chip background behind faction-only match-list icons
enhance; combine likes, comments, and downloads into one match-list column
enhance; show match type in community replay lists
fix; show Basic Match for custom/unranked lobbies instead of size-based 1v1–4v4
fix; match history and live-lobby loading skeletons to the real table layout
fix; fall back to faction flags when match-list players have no stats
enhance; hover rank/faction chips over the full control, not only the icon
