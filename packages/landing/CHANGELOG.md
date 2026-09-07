# @company-of-heroes/landing

## 1.6.0

- feat; edit account profile and verify email on the website and in the app
- enhance; show send text on comment submit instead of an icon
- enhance; use the shared players overview on the current-game / live lobby screen
- fix; do not show ranks, ratings, or profile links for cpu players
- fix; show replay placeholder players (id 0) in the current-game overview
- enhance; show doctrines and CPM on the current-game screen while watching a replay
- fix; label skirmish AI slots as CPU instead of Player N
- fix; render circular faction icons as size-5 with ring-4 everywhere (live lobbies included)
- fix; keep map and profile header images square instead of stretching with the details column
- fix; open landing header dropdowns without async i18n suspense (avoids Svelte batch invariant)
- enhance; mention privacy, no PC scanning, open source, and Authenticode signing on the home hero
- feat; add optional PayPal donations section and header link on the homepage
- enhance; show a shared CoH atmospheric page background on the website and desktop app
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
- fix; show personal match history under the replays My matches tab
- fix; speed up replay list filtering and make replay detail navigation feel instant
- feat; share PocketBase and API client logic in @company-of-heroes/api
- fix; detect skirmish (match type 14) for overlay and live lobbies, including cpu race updates
- enhance; use solid button fills instead of transparent backgrounds
- feat; add Steam OpenID login on the website with PocketBase account find-or-create

## 1.5.0

- fix; update the header login state immediately after signing in without a manual refresh
- fix; take fair play shots via company of heroes print screen, with window capture as fallback
- enhance; share the same player profile UI components across the app and website
- fix; load website live lobbies from lobbies_live like the companion instead of a slow custom API
- feat; upvote and downvote players on profiles, and show net rating next to player names
- enhance; align home player search with shared Form.Group controls
- enhance; remove home download section, Download nav link, and SmartScreen notice
- enhance; rename site brand to Company of Heroes - Companion app
- enhance; rename hero download button to Download app
- enhance; even out Form.Group vertical padding
- enhance; show staff-only account debug on player profiles, replays, and matches

## 1.4.0

- feat; mark comments as deleted instead of removing them
- feat; comment avatars and up/down votes
- enhance; flatten comment replies to one indent and @mention the parent author
- enhance; sort comments by vote score
- fix; make the fairplay capture more reliable
- feat; language switcher and localized website routes for Spanish and Korean
- feat; show comments and likes on community replay pages
- feat; match website replay details to the app and let staff hide matches on the site
- feat; reposition coh1stats.com as a Company of Heroes 1 stats home with player search, live lobbies, recent matches, and livestreams
- feat; expand live lobby rows and open player details on coh1stats.com
- fix; match community replay loading skeletons to the list and detail layouts
- feat; up/down votes on replays instead of a like toggle
- feat; shared `@company-of-heroes/ui` component library for app and landing (Turborepo task graph, unified buttons, leaderboards, replays, player performance)
- enhance; sort replays by comment count in a dedicated column
- feat; log in and create an account on coh1stats.com; edit login credentials in the app account settings; log in on the website with the desktop app when it is running

## 1.3.1

- enhance; leave the fair play all-chat announce off until you turn it on

## 1.3.0

- feat; browse and watch community replays on the website

## 1.2.3

- fix; prevent desktop screenshots during fair play

## 1.2.2

- fix; typo

## 1.2.1

- enhance; rewrite homepage copy so it matches the companion and stays factually accurate
- enhance; style the SmartScreen notice as a warning alert
- enhance; mention SignPath Foundation as the Authenticode signing path
- enhance; load player profiles faster in the app and on the website
- enhance; publish an up-to-date privacy policy covering the website, match stats, and fair play checks
- fix; allow opening the privacy policy url from the desktop app
- feat; highlight fair play and cheater checks on the homepage
- feat; show Relic player labels on public player pages and leaderboards
- fix; stop windows eperm on landing builds by not locking the cloudflare output dir

## 1.2.0

- enhance; remove compact ranked card from public player pages
- enhance; align landing visual design with the companion app
- fix; align landing header and page content to the same max width
- fix; lift public player page surfaces so they match the app
- fix; add left and right borders to the landing content column
- fix; make public player pages flush to the content column like the app
- fix; turn the landing header into flush blocks like the app chrome
- fix; rest the header download cell until hover
- fix; make the player lookup field compact and match the header blocks
- fix; flush the player lookup input and submit as adjacent header cells
- fix; darken landing surfaces to match the app main pane
- fix; match public player stats and match history to the app tables
- enhance; color public player ELO and show map thumbnails like the app
- enhance; match public player performance to the app accordion layout
- fix; fill header action cells at rest and brighten them on hover
- enhance; show a player profile skeleton while stats are loading
- fix; restyle the landing homepage to match the app chrome
- feat; pick Fknoobs CoH or the global community from Discord
- feat; show Relic leaderboards on the public site
- feat; show public player stats on coh1stats.com instead of playercard.cohstats
- feat; show smurf accounts on public player profiles
- feat; ship a linux appimage on github releases

## 1.1.1

- feat; add global keybindings that apply in every match regardless of faction
- feat; install updates in the background and restart when ready
- fix; ship the NSIS installer so background updates apply to new installs

## 1.1.0

- feat; extend player card
- enhance; treat 2400+ ELO as legendary
- feat; color ELO ratings by skill tier in stats and oppbot overlay

## 1.0.1

- feat; extend player card
