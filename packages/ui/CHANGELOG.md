# @company-of-heroes/ui

## 0.13.0

- fix; wiki shows the guns of HMG and mortar teams, Tank Busters, Assault Grenadiers, the Crocodile, Calliope, Hetzer and halftracks, and links research weapons (BAR, 76mm, APCR, Ranger bazookas) to their units
- enhance; wiki weapon target table shows ×1 instead of a dash where a weapon has no modifier against an armour type
- fix; wiki reinforce costs of team weapons, emplacement and glider prices, Panzer Elite tech tiers, duplicate doctrine abilities and weapon names are corrected
- feat; wiki shows who builds what, building and research prerequisites, the emplacements, mines and gliders doctrines unlock, abilities a doctrine pick grants, and medal reward units with a badge
- enhance; wiki weapon stats show the distant band, aim, burst and reload ranges, per-range timing multipliers, rear penetration, targets a weapon cannot hit and area damage by distance from the impact
- fix; wiki upgrade popovers show the faction of the page instead of US Forces for upgrades several factions share (Wehrmacht phases)

## 0.12.0

- feat; tournaments with a banner, logo and map pool (including custom maps), single elimination, double elimination and round robin brackets, sign-up, seeding by ELO, plus a champion medal (picked by staff) on the winner's player profile, a replays tab with every game once the tournament is finished, and tournament games: deadlines per round with warnings, "Start tournament game" on the app dashboard, games hidden until the tournament ends, automatic results with a celebration popup, a popup when a tournament you play in starts, an Updates tab with staff posts and automatic updates (rule changes, disqualifications, deadlines, start, finish, cancel) that notify every participant in the app and on Windows, personal notices (signed up, starts soon, next match ready, staff result, knocked out, final place), a step-by-step guide for participants, opponent Steam links, "Report a problem" for matches, problem reports that staff resolve or dismiss with a note for the player, rules acceptance at sign-up and after rule changes, registration that closes automatically, proposing and accepting match times with a reminder, a stream link, featured match and LIVE markers, statistics and a hall of fame for finished tournaments, a notification bell on the website, community tournament hosts (players request the host role, staff approve it, hosts create and run their own tournaments), overdue notices for staff, and running or open tournaments on the website home page and app dashboard
- enhance; rename "My replays" to "Replay Manager" and "Member replays" to "Shared Replays"
- enhance; inputs, selects, buttons and toggles share one h-8 height, background and border; file upload fields use a dark dashed drop zone; page tabs are flush with a gold underline on the active tab
- enhance; redesign comments: compact rows with inline voting and actions, plus a comment box with quick replies
- enhance; compact, subtler replay upload prompt on community matches
- enhance; every badge uses one shared style: a solid grey badge with a coloured status dot, readable on images too
- enhance; every hover hint now uses the styled tooltip instead of the plain browser tooltip

## 0.11.1

- feat; report wrong info on a wiki page, admins and moderators get a notification and review reports under Management

## 0.11.0

- feat; show VAC and game bans prominently on player profiles
- feat; community statistics on the homepage and a new statistics page: maps, faction win rates, matchups, doctrines, most built units, openings and upgrades from replays (stored matches and uploaded replays), per mode (ranked, Basic Match, Skirmish), preset or custom date range, and per map (click a map to filter)
- enhance; profile links show the full url in a popover before opening
- enhance; replay chat marks your own messages with a dot and all-chat with an [all] prefix, and shows the original under translated messages
- fix; British Field Support and Armor Command Trucks show as themselves in replay timelines and statistics instead of US Airborne
- fix; detect skirmishes against AI from the replay and label them Skirmish instead of Basic Match
- fix; show repeated clicks on the same ability once on the replay timeline
- feat; replay timeline and statistics popovers show game stats: unit health, weapons and veterancy bonuses, upgrade effects (bonus health, accuracy, …), the weapon a package adds with its damage, range and accuracy, and what a doctrine unlock gives
- feat; add a wiki with unit, building, commander and weapon pages and staff tips

## 0.10.0

- feat; the desktop app opens on a login screen (steam, email and password, register a personal account or create an anonymous one) instead of silently creating an account; the warnings.log and game folder are now optional and only the features that need them turn off
- fix; show cancelled buildings under construction in the replay timeline with a cancel mark and refunded cost
- feat; copy a shareable coh1stats.com link to a replay from the replay detail page
- fix; show player rank and ladder position in match history, including arranged team and 2v2 assault / panzerkrieg games, using the rank at match time when the match was saved

## 0.9.0

- feat; in-game style replay timeline with action icons per row (structures, units, defenses, upgrades, abilities, doctrine) on faction and doctrine art, including cancelled production and upgrades, Wehrmacht veterancy stripes, a hover popover with each order’s resource cost and in-game description (click to pin), and estimated resources spent per player
- enhance; toggle groups show each option as a button, with the selected option in a lighter secondary colour
- feat; add the Company of Heroes - Replay Manager desktop app to browse, search, rename and delete the replays in your local playback folder
- fix; website no longer scrolls horizontally on mobile and replay chat reads better on small screens
- enhance; larger tooltips that match the app's popover styling
- enhance; faction flags use the same round icon everywhere (stats, match history, leaderboards, performance, dashboard)
- enhance; modals open and close instantly without animation

## 0.8.0

- feat; spotlight top replays and add replay upload prompts across the website
- fix; show elo, wins and losses on the match page right after a game instead of only names and cpm
- fix; basic matches are no longer shown, titled or filtered as ranked, and the elo chart opens on ranked
- fix; faction and map stats count only ranked games of the profile you are looking at, not other linked steam accounts
- fix; a replay or next game is no longer attached to the previous match when the game log skips its end
- fix; hide duplicate copies of the same match in history

## 0.7.0

- enhance; close the filter panel after Apply, show filtered players by name, and highlight them in blue in match lists
- enhance; the player hover popup now shows the player's likes and badges, also when hovering a player inside a match
- refactor; the desktop app and website now render the same components from `@company-of-heroes/ui` (player profile, likes, comments, replay detail/upload/edit, leaderboards, live lobbies, profile form). Shared components translate themselves and reach host features through one host context, so a change is made in one place. The app profile now shows the player's level, the website performance panel translates "Games", website match history dates follow the page language, and the website upload, replay edit and profile forms save without a full page reload.
- fix; stop modals, popovers and side panels (such as filters) from flickering or flashing back for a moment when they close
- feat; unlock rewards: admins create rewards with a 150x150 image, title, description and conditions (matches played or won per faction, mode, map, ranked, Pro or high-ELO lobby and match length; upset wins, win streaks, rating reached, hours played, matches recorded; reputation, comments, replies, upvotes given and received, replays uploaded or downloaded; profile complete, account age, hours streamed, fair play matches and overlay published); players unlock them automatically (past matches count too) with a notification; unlocked rewards show as icons under the bio on player profiles in the app and on the website (hover for title and description), and on your own profile locked rewards show too, with your progress
- enhance; leaderboard stats tables show total wins, losses and games at the bottom
- feat; rename the Twitch page to Streaming and add YouTube Live (connect via website OAuth so the Google client secret stays server-side, TTS from live chat, bot messages and player stats in chat); connecting Twitch or YouTube shows the channel under your name on your profile (disconnecting removes it, and the Twitch/YouTube URL fields are gone from Update profile), and 12 hours of streaming Company of Heroes grants the Streamer badge automatically, which turns green while that player is streaming

## 0.6.1

- fix; keep the account menu above page content so its actions stay clickable

## 0.6.0

- fix; scroll the leaderboard top 3 away with the rest of the page
- feat; add public player profile customization (bio, links, background), including dashboard hero
- fix; close match-history and ELO ingest holes, stop fake empty performance, and harden replay/log save paths

## 0.5.2

- enhance; give primary buttons a subtle top light edge instead of a flat outline
- enhance; restore subtle rounded corners via theme radius tokens
- enhance; soften match player skill chips with rounded corners and spacing

## 0.5.1

- fix; show gray chip backgrounds on Basic Match faction icons in match lists

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
