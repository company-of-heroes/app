### v0.41.0

- feat; rework core logic and simplify it
- feat; add command that lets twitch subs change their voice on the fly
- feat; make elevenlabs message tags a twitch subscriptions only feature
- fix; Streamelements TTS working again, it stopped working after they changed auth scheme in their API endpoints
- feat; replay parser now shows real data, just as the replay analyzer, but more! 🎉
- feat; add default username and avatar when username is not set, these are fetched from the connecteds steamprofile if any

### v0.40.1

- patch; make padding in messages less
- fix; current game widget loses state on navigation
- fix; current game widget now properly destroys itself when lobby is destroyed

### v0.40.0

_This update fixes an issue where large Steam IDs were being incorrectly parsed, preventing the user profile from loading on the dashboard._

- feat; added a changelog to let users know what changed per version
- fix; resolved `current game widget` recieving incorrect data
- fix; resolved a bug preventing your profile from appearing on the dashboard.

### v0.39.1

- patch; update elevenlabs model to v3
- tweak; some minor UI elements in the elevenlabs settings UI
- fix; use console instead of logging plugin

### v0.39.0

- feat; add chatroom
- feat; start app on system startup and option to disable this behaviour
- fix; history not restoring properly after nagivation
