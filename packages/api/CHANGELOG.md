# @company-of-heroes/api

## 0.10.0

- feat; labels can get unlock conditions like rewards, and are given automatically to every linked Steam ID that meets all of them
- feat; redesigned replays page with a discover view: featured replays, pro 1v1s, big battles, fast games and most discussed rows, the latest shared replays, one-click watch in game and suggestions to share your own recent matches
- feat; claim unclaimed player accounts from the player page and leaderboards by signing in with Steam
- feat; redesigned leaderboards with rank movement since yesterday and last week, your own position (also outside the top 200), sorting and country / games filters, climbers, fallers and hot streaks
- feat; supporter subscription with medal, supporter ribbons, player card and supporters page
- feat; tournament pages show the host with avatar and profile link, and staff and hosts can upload their own champion medals (PNG or SVG)
- fix; reward unlock notifications are no longer lost, matches recorded twice count once, unfinished matches break win streaks, secret rewards stay hidden, all-faction rewards get their own ribbon, and visitors no longer see a fake "Locked · 0%"
- fix; the Veteran label now reaches every ranked 1v1/2v2 player who has ever been rank 20 on two ladders, one failing ladder no longer stops the others, and a label staff remove from a player stays removed
- feat; guides any signed-in user can draft and send for review and staff or editors publish (later edits wait for review too), filed under categories, with cover and inline images, wiki links, search-engine metadata and translations; a new editor role admins hand out from the users page; upgrade pages in the wiki

## 0.9.0

- feat; staff and hosts can hide a tournament from the public; its players can still open it

## 0.8.0

- feat; head to head record against lobby opponents and on player profiles, with the games behind each matchup
- feat; compare yourself with any player, across all or selected of your accounts
- fix; send a verification email when signing up with email and password

## 0.7.0

- feat; staff and tournament hosts can drag players to change the seeding, and drag players onto each other in a running bracket to swap them (unplayed matches only)
- feat; staff and tournament hosts can generate the bracket during seeding, swap players in it and start the tournament with it later; only they see it until the start
- enhance; faster data loading across the app
- feat; staff and tournament hosts can delete a tournament (hidden from the public, they can still open and restore it)
- enhance; built-in maps in a tournament map pool link to their wiki page
- enhance; show a live badge on the details of a match that is still being played
- enhance; player search (website and desktop app) looks in stored players first (Relic only when nothing is found), sorts results by relevance and loads more while scrolling
- feat; single elimination tournaments can give the quarterfinals and semifinals their own match length, like the final
- feat; account rewards (comments, reputation, streaming, …) only show on your main Steam account, which you can change from the dashboard's account switcher in the app or under Steam accounts on the website's account page
- feat; tournament hosts and staff can add players by Steam ID (also right in the create form) and remove them again, until the tournament starts
- enhance; the Streamer badge is earned per Steam account: streaming time counts for the Steam account you play on, and only that account gets the badge
- feat; reward condition "Ladder rank reached": the highest Relic rank (up to 20) a Steam ID reached in automatch 1v1 to 4v4, per faction and/or mode
- feat; rewards can show one of 200 service ribbons (25 per faction plus 25 global ones, and ranked series with level 1 to 5 stars or pips, grouped in the picker) instead of an uploaded image, picked by staff in the rewards admin (ribbons another reward uses are marked "Already used"); on profiles ribbons are grouped under a small faction label (or "Global"), "Show details" opens the rewards wiki, and every ribbon carries its faction's edge stripes (US olive-white-blue, Wehrmacht black-white-red, British khaki-red, Panzer Elite black-rose, global gold)
- enhance; replay comments moved from below the overview to their own Comments tab, which shows the comment count
- enhance; the champion medal picker marks medals another tournament already uses as "Already used"
- feat; labels can have a tooltip, and labels marked "unlock automatically" (Veteran) are given to every player with rank 20 on two 1v1/2v2 ladders, in any mix of mode and faction
- feat; the wiki (units, buildings, commanders, weapons and maps, with staff tips and issue reports) is now in the desktop app, and a new rewards wiki page lists every ribbon per faction with what unlocks it, including a player's unlocks and your own progress

## 0.6.0

- feat; tournaments with a banner, logo and map pool (including custom maps), single elimination, double elimination and round robin brackets, sign-up, seeding by ELO, plus a champion medal (picked by staff) on the winner's player profile, a replays tab with every game once the tournament is finished, and tournament games: deadlines per round with warnings, "Start tournament game" on the app dashboard, games hidden until the tournament ends, automatic results with a celebration popup, a popup when a tournament you play in starts, an Updates tab with staff posts and automatic updates (rule changes, disqualifications, deadlines, start, finish, cancel) that notify every participant in the app and on Windows, personal notices (signed up, starts soon, next match ready, staff result, knocked out, final place), a step-by-step guide for participants, opponent Steam links, "Report a problem" for matches, problem reports that staff resolve or dismiss with a note for the player, rules acceptance at sign-up and after rule changes, registration that closes automatically, proposing and accepting match times with a reminder, a stream link, featured match and LIVE markers, statistics and a hall of fame for finished tournaments, a notification bell on the website, community tournament hosts (players request the host role, staff approve it, hosts create and run their own tournaments), overdue notices for staff, and running or open tournaments on the website home page and app dashboard

## 0.5.4

- feat; report wrong info on a wiki page, admins and moderators get a notification and review reports under Management

## 0.5.3

- feat; show VAC and game bans prominently on player profiles

## 0.5.2

- fix; show player rank and ladder position in match history, including arranged team and 2v2 assault / panzerkrieg games, using the rank at match time when the match was saved

## 0.5.1

- fix; show elo, wins and losses on the match page right after a game instead of only names and cpm
- fix; basic matches are no longer shown, titled or filtered as ranked, and the elo chart opens on ranked
- fix; faction and map stats count only ranked games of the profile you are looking at, not other linked steam accounts
- fix; a replay or next game is no longer attached to the previous match when the game log skips its end
- fix; hide duplicate copies of the same match in history

## 0.5.0

- enhance; talk to the website API for everything but plain records (match saves, live lobbies, votes, comments, match history, ratings, replay uploads)
- security; steam ids are linked only when no other account owns them (staff resolve conflicts), match results and ratings come only from Relic, emails no longer leak in expanded records, overlays move to overlay.coh1stats.com, and the desktop app refreshes its session, sanitizes notifications and no longer ships the Steam API key
- refactor; the desktop app and website now render the same components from `@company-of-heroes/ui` (player profile, likes, comments, replay detail/upload/edit, leaderboards, live lobbies, profile form). Shared components translate themselves and reach host features through one host context, so a change is made in one place. The app profile now shows the player's level, the website performance panel translates "Games", website match history dates follow the page language, and the website upload, replay edit and profile forms save without a full page reload.
- feat; unlock rewards: admins create rewards with a 150x150 image, title, description and conditions (matches played or won per faction, mode, map, ranked, Pro or high-ELO lobby and match length; upset wins, win streaks, rating reached, hours played, matches recorded; reputation, comments, replies, upvotes given and received, replays uploaded or downloaded; profile complete, account age, hours streamed, fair play matches and overlay published); players unlock them automatically (past matches count too) with a notification; unlocked rewards show as icons under the bio on player profiles in the app and on the website (hover for title and description), and on your own profile locked rewards show too, with your progress
- feat; rename the Twitch page to Streaming and add YouTube Live (connect via website OAuth so the Google client secret stays server-side, TTS from live chat, bot messages and player stats in chat); connecting Twitch or YouTube shows the channel under your name on your profile (disconnecting removes it, and the Twitch/YouTube URL fields are gone from Update profile), and 12 hours of streaming Company of Heroes grants the Streamer badge automatically, which turns green while that player is streaming

## 0.4.1

- fix; reliable profile background and avatar uploads on the website

## 0.4.0

- fix; save match replay on abrupt game exit and prefer longer participant replays
- feat; add public player profile customization (bio, links, background), including dashboard hero
- fix; close match-history and ELO ingest holes, stop fake empty performance, and harden replay/log save paths

## 0.3.1

- fix; allow slower cold player-page loads before timing out

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
