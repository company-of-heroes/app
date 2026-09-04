# @company-of-heroes/pocketbase

## 0.9.1

- feat; management overview to browse, hide, and delete fair-play screenshots

## 0.9.0

- enhance; share the same player profile UI components across the app and website
- fix; load website live lobbies from lobbies_live like the companion instead of a slow custom API
- feat; upvote and downvote players on profiles, and show net rating next to player names

## 0.8.0

- feat; mention users with @ in match comments and link to their profile
- feat; mark comments as deleted instead of removing them
- feat; comment avatars and up/down votes
- enhance; flatten comment replies to one indent and @mention the parent author
- enhance; sort comments by vote score
- feat; match website replay details to the app and let staff hide matches on the site
- feat; reposition coh1stats.com as a Company of Heroes 1 stats home with player search, live lobbies, recent matches, and livestreams
- feat; expand live lobby rows and open player details on coh1stats.com
- feat; up/down votes on replays instead of a like toggle
- feat; award account reputation for comments, votes, downloads, and played matches
- feat; configure reputation scores by trigger in Management

## 0.7.1

- feat; browse and watch community replays on the website
- feat; show the stream overlay while watching a replay, without player stats
- fix; overlay crash when two AI players are on the same team
- fix; drop lobby-setup empty slots when a live match starts

## 0.7.0

- fix; apply the cheater label to every steam account linked to the same user
- fix; expanding a ranked mode on the performance tab no longer lists unranked lobby matches
- enhance; load player profiles faster in the app and on the website
- fix; show newest community matches on the replays page
- enhance; keep leaderboard ELO fresher from Relic match history
- enhance; cron-harvest ELO for ranked leaderboard players from Relic match history
- feat; hide tournament matches whose lobby title matches a staff word list
- feat; let staff hide tournament match results from public overviews
- feat; pick custom hex colors for user labels
- feat; show Relic player labels on public player pages and leaderboards
- feat; let staff assign Relic player labels from the profile page
- feat; assign public labels to Relic players instead of app accounts
- fix; match history and form by steam id, not who uploaded the lobby
- fix; saving a hidden title word no longer fails after the record is created
- enhance; serve public leaderboards from a warm cache instead of Relic on every request

## 0.6.0

- fix; refresh dashboard profile stats after matches instead of waiting on stale caches
- feat; show Relic leaderboards on the public site
- feat; show public player stats on coh1stats.com instead of playercard.cohstats
- feat; show smurf accounts on public player profiles
- feat; show live Company of Heroes streams on the Twitch page
- enhance; flush live stream tiles into the Twitch panel
- enhance; notify prior match commenters and deep-link highlight from notifications
- fix; merge duplicate accounts that share a steam id into the newest app version
- fix; remove duplicate lobby rows and show unique matches in history
- feat; add staff-managed user labels with public badges

## 0.5.0

- feat; take random in-game screenshots and report known cheat processes during matches
- feat; show match screenshots for community review and label confirmed cheaters
- fix; show existing match screenshots on player profiles and in the admin captures tab
- enhance; open player and match captures in a larger preview modal
- feat; allow admins to impersonate users from management
- feat; filter history by mode, lobby position, ELO, and duration, and sort by likes, downloads, and comments
- fix; history ELO filter uses match ratings when player index elo is empty
- fix; don't block pocketbase startup on history catalog sql backfill
- feat; like, download, and comment on match history
- feat; notify match players when someone comments
- feat; like, reply to, and edit match comments in nested threads
- enhance; write multiline comments with a markdown toolbar
- enhance; show comment counts before the map name

## 0.4.0

- feat; add player elo history endpoint from lobby results
- feat; add elo history charts per game mode and faction on the performance tab
- feat; fill lobby results from Relic match history via cron

## 0.3.1

- enhance; expand faction and mode performance rows to show matching games
- fix; keep match history on live lobbies so the stream overlay can show elo again
- fix; matches played today find lobbies by user steamIds in players/result when lobbyPlayers is empty
- fix; stop wiping lobbyPlayers on lobby save when players fail to parse; repair empty lobbyPlayers rows

## 0.3.0

- fix; speed up local PocketBase startup
- feat; harvest match-history ELO ratings for known players via cron
- fix; upsert all match-history ELO ratings into player_ratings
- fix; restore match-history API helpers after harvest rewrite
- enhance; fill missing player ELO from PocketBase matches and teammate Relic history
- enhance; make the leaderboard ELO column sortable
- fix; read and merge player_ratings elo via SQL fallback when PocketBase json field returns empty
- feat; show tracked winrate by map, faction, and mode on dashboard and player profiles
- feat; close to system tray so match tracking and overlays keep running
- enhance; align performance tab with leaderboard and match history styling; hide skirmish from modes; combine tracked stats across all linked steam accounts; drop the elo trend chart
- enhance; link recent match badges to match details with faction flag and mode tooltips
- enhance; load the performance tab from indexed match stats instead of scanning lobby json on every request
- fix; show the latest matches in the performance recent row, newest first
- enhance; blend performance map tables into the profile widget like stats and live lobbies
- feat; expand map rows inline to show matches and link each row to match history
- fix; group lobby players by team and drop yellow me-row background while keeping primary name color
- fix; ignore invalid country codes in player country flags instead of crashing display names
- enhance; stop storing opponent match history inside saved lobbies, which shrinks the database and speeds up every match query
- enhance; aggregate the performance tab entirely in the match index so it no longer scans the lobby table
- fix; keep backfill progress across restarts so the batch jobs finish instead of restarting from the first page
- fix; spread the batch jobs over separate minutes so they no longer all write in the same minute
- enhance; only load the performance tab once its panel is opened
- fix; matches played today resolve participation from the logged-in user steamIds via lobby_player_index

## 0.2.10

- feat; update overlay to reflect ELO changes

## 0.2.9

- feat; link player match history to saved matches with view details

## 0.2.8

- feat; extend player card

## 0.2.7

- feat; add 'oppbot has a new version' modal. For devs or players that changed the oppbot code, just bump the version to a high number so that the dialog will not appear anymore
- fix; oppbot overlay had visual bugs in certain conditions

## 0.2.6

- feat; add faction filter to filter by faction in match history

## 0.2.5

- fix; previous version broke the 'matches played today' widget

## 0.2.4

- fix worker

## 0.2.3

- fix; clicking 'view details' from match history widget results into a crash

## 0.2.2

- enhance; edited the default oppbot overlay design a bit

## 0.2.1

- fix; some minor UI tweaks throughout the app
- fix; some minor issues in the oppbot overlay
- fix; increase performance on history page
- fix; panic error caused by incorrect null reference

## 0.2.0

- fix; release only on changeset version changes
- security; fixed a leak, where users could potentially upgrade their role to administrative roles
