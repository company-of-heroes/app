# @company-of-heroes/ui

## 0.5.0

- enhance; darken skeleton shimmer for loading placeholders
- enhance; tighten match history columns and use a View match button
- enhance; show rank icons in player match history
- enhance; tighten match history column order and alignment
- enhance; use View match button instead of details link
- fix; match history loading skeleton to the real table layout
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
- enhance; share match list cells for live lobbies and match tables across app and website
- feat; show a compact player card when hovering profile links
- enhance; show faction match stats on rank/faction square previews
- enhance; include basic match leaderboard stats in faction square previews
- fix; show Pro gameplay badges on replay list rows again
- feat; replace sidebar filters with a rule-row query builder (AND/OR) backed by a filter AST API; persist history list filters across match navigation; app and website open filters in a left sheet so the list stays full-width; list sort controls (date/likes/downloads/comments) beside Filters
- fix; link replay overview players to the correct profiles when lobby stubs lack names
- enhance; reuse shared tabs, dialog, leaderboard, and player-performance ui across app and website
- enhance; use sharp corners across shared UI controls and surfaces
- fix; place skirmish live lobby players by Relic team instead of race alone

## 0.4.3

- fix; create and link durable matches only in the lobbies_live PocketBase hook; /live always redirects to /replays

## 0.4.2

- enhance; show the shared players overview (rating / cpm) on live lobby detail, matching replays

## 0.4.1

- enhance; make the public site usable on mobile

## 0.4.0

- enhance; show send text on comment submit instead of an icon
- enhance; use the shared players overview on the current-game / live lobby screen
- fix; do not show ranks, ratings, or profile links for cpu players
- fix; show replay placeholder players (id 0) in the current-game overview
- enhance; show doctrines and CPM on the current-game screen while watching a replay
- fix; label skirmish AI slots as CPU instead of Player N
- fix; render circular faction icons as size-5 with ring-4 everywhere (live lobbies included)
- fix; keep map and profile header images square instead of stretching with the details column
- enhance; restyle modal and dialog shells to match flush app chrome
- fix; open landing header dropdowns without async i18n suspense (avoids Svelte batch invariant)
- enhance; show a live badge on live lobbies and current game, and a pending badge on matches awaiting a result
- fix; keep the live badge on saved matches that are still in an active lobby
- fix; show pending (not live) in match history lists such as matches played today
- enhance; highlight your own player with a primary ring when signed in on the site
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
- feat; share PocketBase and API client logic in @company-of-heroes/api
- fix; detect skirmish (match type 14) for overlay and live lobbies, including cpu race updates
- enhance; use solid button fills instead of transparent backgrounds

## 0.3.0

- enhance; share the same player profile UI components across the app and website
- fix; load website live lobbies from lobbies_live like the companion instead of a slow custom API
- feat; upvote and downvote players on profiles, and show net rating next to player names
- enhance; align home player search with shared Form.Group controls
- enhance; remove home download section, Download nav link, and SmartScreen notice
- enhance; rename site brand to Company of Heroes - Companion app
- enhance; rename hero download button to Download app
- enhance; even out Form.Group vertical padding
- enhance; show staff-only account debug on player profiles, replays, and matches

## 0.2.0

- feat; mark comments as deleted instead of removing them
- feat; comment avatars and up/down votes
- enhance; flatten comment replies to one indent and @mention the parent author
- enhance; sort comments by vote score
- feat; show comments and likes on community replay pages
- feat; match website replay details to the app and let staff hide matches on the site
- feat; reposition coh1stats.com as a Company of Heroes 1 stats home with player search, live lobbies, recent matches, and livestreams
- feat; expand live lobby rows and open player details on coh1stats.com
- fix; match community replay loading skeletons to the list and detail layouts
- feat; up/down votes on replays instead of a like toggle
