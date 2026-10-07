# @company-of-heroes/api

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
