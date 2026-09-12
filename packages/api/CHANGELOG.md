# @company-of-heroes/api

## 0.3.0

- enhance; show player rank and level in community and member match lists
- enhance; use shared rank assets and show unranked badge when level is missing
- enhance; show match roster as compact rank chips instead of bordered tiles
- enhance; enlarge match-list rank and faction icons for readability
- fix; never show rank badges on Basic Match / unranked rows (faction flags only)
- fix; drop chip background behind faction-only match-list icons
- enhance; combine likes, comments, and downloads into one match-list column
- enhance; show match type in community replay lists
- fix; show Basic Match for custom/unranked lobbies instead of size-based 1v1–4v4
- fix; match history and live-lobby loading skeletons to the real table layout
- fix; fall back to faction flags when match-list players have no stats
- enhance; hover rank/faction chips over the full control, not only the icon
- feat; replace sidebar filters with a rule-row query builder (AND/OR) backed by a filter AST API; persist history list filters across match navigation; app and website open filters in a left sheet so the list stays full-width; list sort controls (date/likes/downloads/comments) beside Filters

## 0.2.2

- fix; harden auth cookie and history filters; surface live/home load failures instead of empty UI
- fix; skip lobbies_live upserts when only replay placeholders are present so PocketBase does not reject empty players
- fix; attach match replays after crash/alt-f4 and keep the largest participant upload

## 0.2.1

- fix; steam and app website login no longer fail with an invalid or expired login link

## 0.2.0

- feat; edit account profile and verify email on the website and in the app
- feat; management overview to browse, hide, and bulk-delete fair-play screenshots
- enhance; show a live badge on live lobbies and current game, and a pending badge on matches awaiting a result
- fix; keep the live badge on saved matches that are still in an active lobby
- fix; show pending (not live) in match history lists such as matches played today
- feat; add member replay uploads with compose preview, ladder-stats snapshots, and per-player Steam ID linking when missing from the .rec
- feat; owners can edit member replay title, description, and Steam links, and soft-delete uploads (hidden from public; retained for staff)
- feat; require a description on member replay upload, edit, and publish-from-match
- enhance; drag-and-drop .rec file picker on member replay upload
- fix; parse .rec files in a worker and return slim results (no action dump) so the UI stays responsive
- fix; wire mention user search on member replay descriptions and anchor the popup above the @
- enhance; open member replay upload as a full page in the app (same flow as the website)
- enhance; show member replay details in the app with the same header layout as the website
- fix; render member replay descriptions as markdown (bold, mentions) on detail pages
- enhance; share member replay detail header between app and website
- enhance; add up/down votes on member replays like match likes
- feat; add comments on member replays
- enhance; hide Screenshots tab on member replay detail (uploads have none)
- fix; align app replay detail loading skeleton with the website layout
- feat; publish an owned community match as a member replay (leaves Community matches; stays under My matches)
- fix; show personal match history under the replays My matches tab
- fix; speed up replay list filtering and make replay detail navigation feel instant
- feat; share PocketBase and API client logic in @company-of-heroes/api
- fix; detect skirmish (match type 14) for overlay and live lobbies, including cpu race updates
- fix; detect family-share smurfs via Steam only without cohstats
- feat; add Steam OpenID login on the website with PocketBase account find-or-create
