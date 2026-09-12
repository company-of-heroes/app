# @company-of-heroes/i18n

## 0.1.6

- feat; show Steam concurrent player count in the app header
- enhance; show rank icons in player match history
- enhance; tighten match history column order and alignment
- enhance; use View match button instead of details link
- fix; match history loading skeleton to the real table layout
- feat; replace sidebar filters with a rule-row query builder (AND/OR) backed by a filter AST API; persist history list filters across match navigation; app and website open filters in a left sheet so the list stays full-width; list sort controls (date/likes/downloads/comments) beside Filters

## 0.1.5

- fix; harden auth cookie and history filters; surface live/home load failures instead of empty UI

## 0.1.4

- fix; steam and app website login no longer fail with an invalid or expired login link

## 0.1.3

- feat; edit account profile and verify email on the website and in the app
- feat; management overview to browse, hide, and bulk-delete fair-play screenshots
- enhance; rebuild dashboard hero as a profile-style shell with streak, peak, best map, and fresher ranks
- feat; ask once to enable fair-play all-chat announce
- feat; report unknown DLLs loaded into Company of Heroes during fair play checks
- enhance; mention privacy, no PC scanning, open source, and Authenticode signing on the home hero
- feat; add optional PayPal donations section and header link on the homepage
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
- feat; add Steam OpenID login on the website with PocketBase account find-or-create

## 0.1.2

- enhance; align home player search with shared Form.Group controls
- enhance; remove home download section, Download nav link, and SmartScreen notice
- enhance; rename site brand to Company of Heroes - Companion app
- enhance; rename hero download button to Download app
- enhance; even out Form.Group vertical padding
- enhance; show staff-only account debug on player profiles, replays, and matches

## 0.1.1

- feat; show a what's-new popup with markdown highlights after updates
