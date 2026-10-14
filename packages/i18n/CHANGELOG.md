# @company-of-heroes/i18n

## 0.2.3

- feat; staff and hosts can hide a tournament from the public; its players can still open it

## 0.2.2

- feat; head to head record against lobby opponents and on player profiles, with the games behind each matchup
- feat; compare yourself with any player, across all or selected of your accounts

## 0.2.1

- enhance; player profile and dashboard headers use the new hero layout with a stat strip, like the tournament pages; player labels (Staff, Streamer, …) use the shared badge style everywhere; admin label and notification lists use the regular tables
- feat; wiki maps: every built-in map (classic and Operations) with victory, fuel, munition and strategic points, territory sectors and starting positions on the loading-screen map
- enhance; the tournament form has "Save as draft" and "Create and open registration", and a tournament nobody signed up for yet can go back to draft
- enhance; more compact tournament form: format, match length and final on one row, schedule and player limit on one row, logo and a smaller banner upload side by side
- feat; copy button next to every Steam ID
- feat; staff and tournament hosts can drag players to change the seeding, and drag players onto each other in a running bracket to swap them (unplayed matches only)
- feat; staff and tournament hosts can generate the bracket during seeding, swap players in it and start the tournament with it later; only they see it until the start
- feat; staff and tournament hosts can delete a tournament (hidden from the public, they can still open and restore it)
- feat; wiki shows who builds what, building and research prerequisites, the emplacements, mines and gliders doctrines unlock, abilities a doctrine pick grants, and medal reward units with a badge
- enhance; rewards show as a compact ribbon rack: one ribbon per ranked series (the highest level you reached), smaller and closer together; on your own profile and dashboard locked rewards no longer look earned and only the 3 closest show under "Next" (faded with a lock, "Locked · x%" in the tooltip), the rest behind "+N more"
- feat; single elimination tournaments can give the quarterfinals and semifinals their own match length, like the final
- feat; account rewards (comments, reputation, streaming, …) only show on your main Steam account, which you can change from the dashboard's account switcher in the app or under Steam accounts on the website's account page
- feat; tournament hosts and staff can add players by Steam ID (also right in the create form) and remove them again, until the tournament starts
- enhance; the Streamer badge is earned per Steam account: streaming time counts for the Steam account you play on, and only that account gets the badge
- feat; reward condition "Ladder rank reached": the highest Relic rank (up to 20) a Steam ID reached in automatch 1v1 to 4v4, per faction and/or mode
- fix; show the British faction as Commonwealth instead of British Forces
- feat; rewards can show one of 200 service ribbons (25 per faction plus 25 global ones, and ranked series with level 1 to 5 stars or pips, grouped in the picker) instead of an uploaded image, picked by staff in the rewards admin (ribbons another reward uses are marked "Already used"); on profiles ribbons are grouped under a small faction label (or "Global"), "Show details" opens the rewards wiki, and every ribbon carries its faction's edge stripes (US olive-white-blue, Wehrmacht black-white-red, British khaki-red, Panzer Elite black-rose, global gold)
- feat; visitors without an account see the join button on a tournament and can sign in with Steam or an existing account from there
- enhance; the champion medal picker marks medals another tournament already uses as "Already used"
- feat; labels can have a tooltip, and labels marked "unlock automatically" (Veteran) are given to every player with rank 20 on two 1v1/2v2 ladders, in any mix of mode and faction
- feat; the wiki (units, buildings, commanders, weapons and maps, with staff tips and issue reports) is now in the desktop app, and a new rewards wiki page lists every ribbon per faction with what unlocks it, including a player's unlocks and your own progress

## 0.2.0

- feat; tournaments with a banner, logo and map pool (including custom maps), single elimination, double elimination and round robin brackets, sign-up, seeding by ELO, plus a champion medal (picked by staff) on the winner's player profile, a replays tab with every game once the tournament is finished, and tournament games: deadlines per round with warnings, "Start tournament game" on the app dashboard, games hidden until the tournament ends, automatic results with a celebration popup, a popup when a tournament you play in starts, an Updates tab with staff posts and automatic updates (rule changes, disqualifications, deadlines, start, finish, cancel) that notify every participant in the app and on Windows, personal notices (signed up, starts soon, next match ready, staff result, knocked out, final place), a step-by-step guide for participants, opponent Steam links, "Report a problem" for matches, problem reports that staff resolve or dismiss with a note for the player, rules acceptance at sign-up and after rule changes, registration that closes automatically, proposing and accepting match times with a reminder, a stream link, featured match and LIVE markers, statistics and a hall of fame for finished tournaments, a notification bell on the website, community tournament hosts (players request the host role, staff approve it, hosts create and run their own tournaments), overdue notices for staff, and running or open tournaments on the website home page and app dashboard
- enhance; rename "My replays" to "Replay Manager" and "Member replays" to "Shared Replays"
- enhance; redesign comments: compact rows with inline voting and actions, plus a comment box with quick replies

## 0.1.14

- feat; report wrong info on a wiki page, admins and moderators get a notification and review reports under Management

## 0.1.13

- feat; show VAC and game bans prominently on player profiles
- feat; community statistics on the homepage and a new statistics page: maps, faction win rates, matchups, doctrines, most built units, openings and upgrades from replays (stored matches and uploaded replays), per mode (ranked, Basic Match, Skirmish), preset or custom date range, and per map (click a map to filter)
- enhance; profile links show the full url in a popover before opening
- feat; replay timeline and statistics popovers show game stats: unit health, weapons and veterancy bonuses, upgrade effects (bonus health, accuracy, …), the weapon a package adds with its damage, range and accuracy, and what a doctrine unlock gives
- feat; add a wiki with unit, building, commander and weapon pages and staff tips
- enhance; the navbar shows Discord as an icon button and no longer links to donations

## 0.1.12

- feat; the desktop app opens on a login screen (steam, email and password, register a personal account or create an anonymous one) instead of silently creating an account; the warnings.log and game folder are now optional and only the features that need them turn off
- feat; staff can copy the raw Relic JSON of a match history item
- fix; show cancelled buildings under construction in the replay timeline with a cancel mark and refunded cost
- feat; copy a shareable coh1stats.com link to a replay from the replay detail page

## 0.1.11

- feat; add a Replay Manager download to the homepage banner and explain how it differs from the companion app

## 0.1.10

- enhance; redesigned startup error screen and show a maintenance notice that reconnects automatically when the server is unreachable
- enhance; redesigned the startup splash with an animated logo, boot progress, rotating tips and the app version

## 0.1.9

- security; steam ids are linked only when no other account owns them (staff resolve conflicts), match results and ratings come only from Relic, emails no longer leak in expanded records, overlays move to overlay.coh1stats.com, and the desktop app refreshes its session, sanitizes notifications and no longer ships the Steam API key
- feat; unlock rewards: admins create rewards with a 150x150 image, title, description and conditions (matches played or won per faction, mode, map, ranked, Pro or high-ELO lobby and match length; upset wins, win streaks, rating reached, hours played, matches recorded; reputation, comments, replies, upvotes given and received, replays uploaded or downloaded; profile complete, account age, hours streamed, fair play matches and overlay published); players unlock them automatically (past matches count too) with a notification; unlocked rewards show as icons under the bio on player profiles in the app and on the website (hover for title and description), and on your own profile locked rewards show too, with your progress
- enhance; leaderboard stats tables show total wins, losses and games at the bottom
- feat; rename the Twitch page to Streaming and add YouTube Live (connect via website OAuth so the Google client secret stays server-side, TTS from live chat, bot messages and player stats in chat); connecting Twitch or YouTube shows the channel under your name on your profile (disconnecting removes it, and the Twitch/YouTube URL fields are gone from Update profile), and 12 hours of streaming Company of Heroes grants the Streamer badge automatically, which turns green while that player is streaming

## 0.1.8

- feat; add public player profile customization (bio, links, background), including dashboard hero

## 0.1.7

- fix; stop community replay pages from hanging on fat lobby player payloads

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
