### v0.42.0

- enhance; reworked match history
- enhance; current game widget overhaul, now shows better and more info on dedicated page.
- fix; players with same name would get merged, now uses player ID instead of name
- feat; add code signing certificate! 🎉

### v0.41.0

> If this update causes issues, please downgrade

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
