# @company-of-heroes/app

## 0.63.0

- feat; management overview to browse, hide, and delete fair-play screenshots
- enhance; management sidebar with separate admin pages
- feat; ask once to enable fair-play all-chat announce
- feat; share PocketBase and API client logic in @company-of-heroes/api

## 0.62.0

- fix; install and restart automatically once an update finishes downloading
- feat; sign Windows installers with Azure Artifact Signing
- fix; take fair play shots via company of heroes print screen, with window capture as fallback
- enhance; share the same player profile UI components across the app and website
- fix; load website live lobbies from lobbies_live like the companion instead of a slow custom API
- fix; play the match-start notification sound more reliably when CoH is not focused
- feat; upvote and downvote players on profiles, and show net rating next to player names
- enhance; show staff-only account debug on player profiles, replays, and matches

## 0.61.0

- feat; mention users with @ in match comments and link to their profile
- feat; mark comments as deleted instead of removing them
- feat; comment avatars and up/down votes
- enhance; flatten comment replies to one indent and @mention the parent author
- enhance; sort comments by vote score
- fix; update the hide/show match button after toggling visibility
- fix; make the fairplay capture more reliable
- feat; up/down votes on replays instead of a like toggle
- feat; shared `@company-of-heroes/ui` component library for app and landing (Turborepo task graph, unified buttons, leaderboards, replays, player performance)
- enhance; sort replays by comment count in a dedicated column
- feat; award account reputation for comments, votes, downloads, and played matches
- feat; configure reputation scores by trigger in Management
- feat; log in and create an account on coh1stats.com; edit login credentials in the app account settings; log in on the website with the desktop app when it is running
- feat; show a what's-new popup with markdown highlights after updates

## 0.60.1

- enhance; leave the fair play all-chat announce off until you turn it on

## 0.60.0

- fix; type [FAIRPLAY] correctly in all-chat on non-us keyboards
- feat; show the stream overlay while watching a replay, without player stats
- fix; overlay crash when two AI players are on the same team
- fix; drop lobby-setup empty slots when a live match starts

## 0.59.6

- fix; block keyboard and mouse while the fair-play chat line is sent, you can disable this in the settings
- enhance; keep form labels, descriptions, and inputs in one visual group
- enhance; match settings game-path fields to the setup screen
- enhance; make form section headers larger than field labels
- fix; allow the main window to close when close-to-tray is off

## 0.59.5

- fix; prevent desktop screenshots during fair play

## 0.59.4

- fix; display fair play message sooner

## 0.59.3

- fix; open Company of Heroes all-chat with shift+enter instead of team chat
- fix; make the entire row collapsible on the screenshots tabs

## 0.59.2

- fix; typo

## 0.59.1

- fix; send the fair-play all-chat announce immediately at match start and pause hotkeys while typing it

## 0.59.0

- enhance; align the management users search form with labels
- fix; apply the cheater label to every steam account linked to the same user
- enhance; restyle the label color picker to match other form controls
- enhance; let match list tables choose which columns to show
- fix; keep the leaderboard player search field compact
- enhance; restyle the dashboard profile to match other dashboard panels
- feat; show Relic player labels on the dashboard profile
- fix; expanding a ranked mode on the performance tab no longer lists unranked lobby matches
- feat; announce fair play in Company of Heroes all-chat during matches
- feat; add a settings toggle for the fair play all-chat announce
- enhance; load player profiles faster in the app and on the website
- enhance; review flagged reports in an expandable table
- enhance; use compact boxed form fields and distinct action buttons across the app
- enhance; tidy the management new-label composer into one field
- fix; show newest community matches on the replays page
- enhance; keep leaderboard ELO fresher from Relic match history
- enhance; cron-harvest ELO for ranked leaderboard players from Relic match history
- feat; hide tournament matches whose lobby title matches a staff word list
- feat; let staff hide tournament match results from public overviews
- enhance; publish an up-to-date privacy policy covering the website, match stats, and fair play checks
- fix; allow opening the privacy policy url from the desktop app
- feat; add korean locale
- feat; pick custom hex colors for user labels
- enhance; show match screenshots in an expandable player table
- feat; default the app language to the os locale until settings override it
- feat; let staff assign Relic player labels from the profile page
- fix; stop fair play screenshots when a match ends so the main menu is not uploaded
- feat; assign public labels to Relic players instead of app accounts
- enhance; paginate player screenshots in an expandable match table
- enhance; detect CoH install paths more reliably and make setup easier to follow
- fix; match history and form by steam id, not who uploaded the lobby
- fix; saving a hidden title word no longer fails after the record is created
- feat; open a player profile from the management users tab

## 0.58.1

- fix; skip blank CoH screenshots and recapture from the visible screen

## 0.58.0

- enhance; make dashboard widgets collapsible
- feat; show compact live Company of Heroes streams on the dashboard
- fix; keep match screenshots loading after the file token expires
- fix; refresh dashboard profile stats after matches instead of waiting on stale caches
- feat; show public player stats on coh1stats.com instead of playercard.cohstats
- feat; ship a linux appimage on github releases
- feat; show live Company of Heroes streams on the Twitch page
- enhance; flush live stream tiles into the Twitch panel
- enhance; notify prior match commenters and deep-link highlight from notifications
- fix; history position filter uses team rows so Wehrmacht on position 1 matches
- fix; merge duplicate accounts that share a steam id into the newest app version
- enhance; show screenshot thumbnails as flush, hover-opaque tiles
- fix; wait for player profiles before sending twitch player stats
- feat; add staff-managed user labels with public badges

## 0.57.0

- enhance; align management, denylist, and flagged reports layouts with other tabbed pages
- fix; show relic aliases on flagged player reports instead of account names
- enhance; align buttons, badges, and tabs with primary chip styling
- enhance; use solid backgrounds on dropdowns, popovers, and context menus
- enhance; show country flags next to player names on match history overview
- feat; take random in-game screenshots and report known cheat processes during matches
- feat; show match screenshots for community review and label confirmed cheaters
- fix; show existing match screenshots on player profiles and in the admin captures tab
- enhance; open player and match captures in a larger preview modal
- feat; add global keybindings that apply in every match regardless of faction
- feat; allow admins to impersonate users from management
- feat; filter history by mode, lobby position, ELO, and duration, and sort by likes, downloads, and comments
- fix; history ELO filter uses match ratings when player index elo is empty
- fix; don't block pocketbase startup on history catalog sql backfill
- feat; merge history and local playback replays into one replays page
- feat; show steam id on the player profile header
- feat; mark high average ELO matches as pro gameplay
- enhance; restyle notification inbox and popover to match app chrome
- feat; install updates in the background and restart when ready
- fix; ship the NSIS installer so background updates apply to new installs
- feat; allow only one app instance at a time
- feat; like, download, and comment on match history
- feat; notify match players when someone comments
- feat; like, reply to, and edit match comments in nested threads
- enhance; write multiline comments with a markdown toolbar
- enhance; show comment counts before the map name
- enhance; enlarge the dashboard W/L form and replay player stats

## 0.56.0

- enhance; drop lobby scout details so ELO, level and position scan first
- fix; stretch dashboard hero stats to the avatar square
- enhance; redesign dashboard profile hero as ranked stat grid
- fix; limit dashboard name link to the name itself
- feat; add english i18n for all ui copy
- enhance; flush the current-game map as a square block
- enhance; flush the dashboard hero avatar as a square block
- enhance; flush dashboard form as edge-to-edge blocks
- enhance; flush the history match map as a square block
- enhance; flush the player profile avatar as a square block
- enhance; flush the replay detail map as a square block
- enhance; flush map thumbnails in match list rows
- fix; poll match status on the history detail page instead of a realtime subscription
- feat; add a dedicated language dropdown for switching the app locale
- fix; keep the language select as wide as its options instead of the full page
- enhance; use a details button in live lobby rows instead of a text link
- fix; open lobby and match details with client-side navigation
- fix; keep the selected language when navigating away from settings
- fix; download replays after rename using the updated PocketBase file reference
- fix; add left padding to list map thumbnails
- fix; keep list map thumbnails at row height
- fix; make language select dropdown opaque and match the trigger width
- fix; stop setup from showing a false missing-path error next to a valid file
- feat; add spanish i18n for all ui copy
- feat; add spanish locale and language picker

## 0.55.0

- enhance; add current-game scouting stats in the existing match header and player table
- feat; add player elo history endpoint from lobby results
- feat; add elo history charts per game mode and faction on the performance tab
- enhance; show country flags and ELO on leaderboards
- feat; fill lobby results from Relic match history via cron
- enhance; clarify oppbot overlay update popup wording and use update instead of overwrite
- enhance; apply blue/green/gold elo tiers and elite glow on the oppbot overlay
- fix; color oppbot overlay streaks green when positive and red when negative
- fix; publish oppbot overlay via app fetch so FormData uploads reach PocketBase
- enhance; show elo rating change on other players performance match lists
- enhance; remove status column from match lists and use a compact details button
- enhance; mute recent-match W/L badges until hover
- enhance; show replay ID on the detail page
- feat; rename replays in the .rec file and PocketBase title, and embed Steam IDs into lobby replays when results arrive
- feat; edit, delete, and download replays from the replays list
- enhance; add admin CLI to fully reparse all stored replays after analyzer updates
- enhance; restyle toasts to match app surface panels
- fix; use opaque toast backgrounds so content no longer shows through

## 0.54.1

- enhance; align current game and live lobby pages with flush dashboard layout
- enhance; split lobby player table into allies and axis columns like replay overview
- fix; redirect to current-game from any page when a match starts
- enhance; retint elo colors as blue (low), green (mid), and premium gold (pro) with a soft glow
- enhance; give 2400+ elo an elite luminous gold treatment with stronger glow
- enhance; expand faction and mode performance rows to show matching games
- fix; show elo gained or lost next to ratings on match detail player rows
- fix; keep match history on live lobbies so the stream overlay can show elo again
- enhance; hide duplicate lobby players table on history when a replay is shown and show rank, elo, level, position, wins, losses, and streak on overview rows
- enhance; restyle replay overview player rows with clearer hierarchy and softer cpm
- enhance; link replay overview player names to their profile
- fix; matches played today find lobbies by user steamIds in players/result when lobbyPlayers is empty
- fix; stop wiping lobbyPlayers on lobby save when players fail to parse; repair empty lobbyPlayers rows

## 0.54.0

- fix; batch steam profile lookups so match lists no longer flood the api with failing requests
- enhance; replace page titles with breadcrumbs and align routes with the flush dashboard layout
- fix; lay out history and replay filter toolbars in a single horizontal strip
- fix; align performance tables with dashboard padding and match-list column rhythm
- fix; lay out replay filters like the history toolbar
- fix; share DataTable chrome across match lists, performance, and recent games
- enhance; use p-4 padding on dashboard sections and tables
- fix; tighten performance stat column spacing
- enhance; move tracked performance summary into dashboard profile header alongside steam id and created date
- enhance; align player profile page layout with dashboard profile widget
- enhance; redesign keybindings page with compact key caps and chord recorder fields
- fix; allow saving, cancelling, and restoring keybinding recordings
- enhance; align leaderboards page with flush layout and inline podium stats
- enhance; align players search page with flush dashboard layout
- enhance; restore global back button in header to return with page snapshot state
- enhance; align match history detail page with flush dashboard layout
- fix; remove stacked borders between match detail sections
- enhance; align replay detail page with flush dashboard layout
- enhance; redesign replay overview player grid with team headers and compact rows
- enhance; highlight replay CPM values with prominent gold badges
- enhance; align match history detail player list and replay tabs with dashboard layout
- fix; pair detail metadata in one grid so labels align across columns
- enhance; move download replay button below match detail metadata
- enhance; align replay chat tab with flush dashboard layout
- enhance; add subtle background to replay chat message area
- enhance; align replay timeline tab with flush dashboard layout
- enhance; align twitch settings page with flush dashboard layout
- enhance; align personal voices settings with flush dashboard layout
- enhance; highlight the logged-in player in gold across lobby and match player lists
- enhance; show a larger map thumbnail on match history detail
- enhance; show a larger profile avatar on the dashboard hero and player profile page
- enhance; split performance tab into collapsible colored sections for maps, factions, and modes
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
- improvement; player profile loading skeleton matches layout with shimmer animation
- improvement; dashboard profile widget uses matching profile skeleton while loading
- fix; show session id on Relic match history cards, not the history table
- enhance; stop storing opponent match history inside saved lobbies, which shrinks the database and speeds up every match query
- enhance; aggregate the performance tab entirely in the match index so it no longer scans the lobby table
- fix; keep backfill progress across restarts so the batch jobs finish instead of restarting from the first page
- fix; spread the batch jobs over separate minutes so they no longer all write in the same minute
- enhance; only load the performance tab once its panel is opened
- enhance; show live lobby start time instead of last update
- fix; fire `game.lobby.joined` and `game.lobby.started` only once per match
- fix; matches played today resolve participation from the logged-in user steamIds via lobby_player_index

## 0.53.2

- feat; update overlay to reflect ELO changes

## 0.53.1

- fix; apply ELO rating colors on match history detail page
- enhance; store ELO for match-history opponents from Relic history
- feat; link player match history to saved matches with view details
- enhance; show session id next to the date on match history

## 0.53.0

- feat; extend player card
- enhance; treat 2400+ ELO as legendary
- feat; color ELO ratings by skill tier in stats and oppbot overlay
- feat; highlight smurf accounts next to player names

## 0.52.13

- feat; color ELO ratings by skill tier in stats and oppbot overlay
- enhance; treat 2400+ ELO as legendary
- feat; highlight smurf accounts next to player names

## 0.52.12

- feat; extend player card

## 0.52.11

- feat; add 'oppbot has a new version' modal. For devs or players that changed the oppbot code, just bump the version to a high number so that the dialog will not appear anymore
- fix; oppbot overlay had visual bugs in certain conditions

## 0.52.10

- feat; add faction filter to filter by faction in match history
- fix; some live lobby matches were stale
- fix; matched played today showed incorrect results
- improvement; swap ELO and Ranking in oppbot overlay

## 0.52.9

- fix; previous version broke the 'matches played today' widget

## 0.52.8

- fix; matches played today only showed matches that were created by logged in user, making some matches not showing up in the widget
- fix; some replays causing out of bounds error
- feat; add live lobby details page, to view more details about a live lobby
- fix; some minor issues we observed throughout the app
- fix; live lobbies only created for lobby owner, causing oppbot overlay to not work for the other players in the lobby

## 0.52.7

- fix; missing import causing app to not load properly on fresh installs

## 0.52.6

- fix; bring back the websocket events, that were removed in a previous version

## 0.52.5

- feat; add markdown support in notification popup
- fix; clicking 'view details' from match history widget results into a crash

## 0.52.4

- enhance; edited the default oppbot overlay design a bit

## 0.52.3

- fix; some minor UI tweaks throughout the app
- fix; some minor issues in the oppbot overlay
- fix; show player ELO, rank icon and position in live lobbies widget
- fix; increase performance on history page
- fix; automatically publish oppbot overlay to remote server

## 0.52.2

- feat; add opponent bot route

## 0.52.1

- feat; oppbot overlay will now use a remote server, this will make it more reliable. Make sure the app is running when using the overlay!
- fix; fixed some cors errors

## 0.52.0

- feat; pagination supports now specifying a page number
- fix; reverse some changes, to prepare for Microsoft Store release
- feat; redesigned the page displaying the active game to be more consistent with rest of the app
- feat; add replay data directly to match history
- enhance; show loading indicators on replay data
- feat; add new players page, where you can search and find CoH player profiles and stats
- feat; add live lobbies, to generate better overlays and increase perfomance on some areas of the app
- feat; add notifications
- enhance; increased performance of history page
- feat; chat messages can now be translated to specified language, E.G. nl, en, ar. You can specify the language to translate in in the language box
- fix; hotkeys were still active after a when not in an active lobby
- security; fixed a leak, where users could potentially upgrade their role to administrative roles
- feat; redesigned dashboard
- fix; remove lobby on lobby destroyed event

## 0.51.1

- > If you have two apps installed after this update, just delete the old one, called Company of Heroes - Companion app
- fix; rename app again, since Company of Heroes is trademarked in the microsoft store

## 0.51.0

- change app name to be compliant with microsoft store rules
- Publish new websocket topic game.lobby.joined, can be used to do things when loading into a game
- fix; make it possible to remap arrow keys
- Disable the hotkeys when chatting and resume when chat closed
- Fix error where app would hang while trying to view a replay
- Increase perfomance of the history page
- Tweak keybindings page UI
- Fix some annoyances and issues
