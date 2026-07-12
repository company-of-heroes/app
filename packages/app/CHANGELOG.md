# @company-of-heroes/app

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
