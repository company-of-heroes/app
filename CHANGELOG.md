### v0.50.2

> In the next release the app will be available to download from the microsoft store!

- fix; change app name to be compliant with microsoft store rules

### v0.50.1

- fix; make it possible to remap arrow keys

### v0.50.0

> This release is a full rewrite of the app's internals. The UI stays the same, the foundation is new.

- feat; **setup wizard**: the app now guides you through selecting your `warnings.log` and Company of Heroes installation folder on first start (with auto-detection) and blocks until both are valid — no more silently broken installs
- feat; **automatic external backups**: your settings _and account_ are continuously backed up to `Documents\FKnoobs CoH\backups`. Updating the app — even when choosing "remove all data" — no longer loses your account; the app restores it automatically
- feat; **comments on matches**: leave comments, reply and like/dislike on any match detail page
- feat; settings import/export rewritten: exports are versioned, imports are validated first and applied instantly (no restart), and a safety backup is written before every import
- feat; settings are migrated automatically from the old format; nothing is lost on update
- enhance; game log watching rewritten: only new log lines are read, and restarting the game (which truncates warnings.log) is now detected correctly
- enhance; Twitch connection lifecycle rewritten: reconnecting or changing tokens can no longer cause duplicated chat/TTS messages
- enhance; match result fetching only polls while results are actually pending (with backoff) instead of every 5 seconds forever
- enhance; local websocket connection now reconnects automatically
- remove; the Chat section has been removed
- chore; the new core logic is covered by an automated test suite

### v0.45.0

- feat; add new _freevoices feature_ for TTS. When enabled, viewers can choose out of a list of free TTS voices, that do not need channel points.
  Two new chat commands are added for this feature, `!freevoices` and `!setfreevoice`
- feat; publish new websocket topic `game.lobby.joined`, can be used to do things when loading into a game
- fix; selection modal rendering outside viewport when inside another model / dialog
- fix; when closing the game, stop analyzing log file

### v0.44.0

- feat; disable the hotkeys when chatting and resume when chat closed
- fix; app hanging / crashing while trying to view a replay
- enhance; increase perfomance of the history page
- enhance; keybindings page UI

### v0.43.4

- fix; current game page not properly updating data when a new game started
- feat; redirect to match history record after finishing lobby
- fix; a memory leak, caused by a wrong filter query
- fix; an issue where realtime data didn't propagate properly throught the component tree

### v0.43.3

- fix; reverted a change that broke the replays page

### v0.43.2

- fix; restore state after nagivating on current game page
- fix; some small overal fixes

### v0.43.1

- fix; match result not saved because of a previous change determining the playback dir

### v0.43.0

- fix; new messages not being displayed because of wrong sort order
- fix; for some players the replay was not attached to the game result
- fix; filtering by players broken because of changes in previous version
- feat; ability to restore account if app was previously installed

### v0.42.1

- enhance; warn about to not uninstall the old version if windows asks for it.

### v0.42.0

- enhance; reworked match history
- enhance; current game widget overhaul, now shows better and more info on dedicated page.
- fix; players with same name would get merged, now uses player ID instead of name
- feat; add code signing certificate! 🎉

### v0.41.0

> If this update causes issues, please downgrade, or upgrade to latest version

- feat; Enhanced replay parser to show comprehensive replay data, matching! 🎉
- feat; Reworked and simplified the core application logic
- feat; Added a command allowing Twitch subscribers to change their voice in real-time
- feat; Restricted ElevenLabs message tags to Twitch subscribers only
- feat; Show more usefull info per match in the user and community matches
- fix; Restored StreamElements TTS functionality by updating authentication to match new API requirements
- feat; Automatically fetch default username and avatar from connected Steam profile if not set
- fix; Resolved an issue where match history only displayed matches created by the user, omitting matches where they were a participant

### v0.40.1

- patch; Reduced padding in chat messages for a more compact view
- fix; Prevented the "Current Game" widget from losing state during navigation
- fix; Ensured the "Current Game" widget is cleanly destroyed when the lobby is closed

### v0.40.0

_This update addresses an issue where large Steam IDs were parsed incorrectly, preventing user profiles from loading on the dashboard._

- feat; Introduced a changelog to keep users informed about version updates
- fix; Corrected data handling in the "Current Game" widget
- fix; Fixed a bug that prevented user profiles from appearing on the dashboard

### v0.39.1

- patch; Updated ElevenLabs model to v3
- tweak; Refined minor UI elements in the ElevenLabs settings
- fix; Replaced logging plugin with standard console output for better stability

### v0.39.0

- feat; Added a new chatroom feature
- feat; Added option to launch app on system startup (with disable toggle)
- fix; Fixed an issue where navigation history was not restoring correctly
