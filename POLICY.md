# Privacy Policy

**Effective date:** October 9, 2026

This Privacy Policy explains how **Code IT** (“we”, “us”) collects, uses, shares, and protects information when you use **Company of Heroes Companion** (also called the FKNOOBS App), the website at [https://coh1stats.com](https://coh1stats.com), and the API at [https://api.coh1stats.com](https://api.coh1stats.com) (together, the “Service”).

We do **not** store or use sensitive personal data. We do not ask for your real name, phone number, home address, payment details, government ID, or anything similar.

The only personal contact detail we might store is an **email address**, and only if you replace the default generated address with a real one. New accounts get a random `@fknoobs.com` email that is not yours. We do not use email for marketing.

Everything else we keep is game data (Steam IDs, in-game aliases, match stats, replays) from Company of Heroes / Relic / Steam — not sensitive information about you in real life.

## 1. Who this applies to

It applies to:

- people who install or use the desktop app;
- people who create an account or log in on the website;
- people who visit the website or call the public API;
- Company of Heroes players whose public multiplayer identity appears in match data, leaderboards, or player pages, even if they never installed the app.

## 2. Information we collect

### a) App and website accounts

When you use the desktop app you can log in with an existing account (email and password, or Steam), register a personal account with your own email and password, or create an anonymous account with a generated login; if the app finds a settings backup with your account, it restores that account so your match history keeps syncing. You can also **create an account or log in on the website** with the same email and password, or **log in with Steam** (OpenID). That account may include:

- a display name and avatar (optional);
- one or more Steam IDs (including the Steam ID used when you sign in with Steam);
- an email address — by default a random `@fknoobs.com` placeholder, or your real email **only if you change it**;
- a password hash (for email/password accounts);
- last login time and the app version;
- staff role, if we grant you one;
- a reputation score derived from comments, votes, replay downloads, player profile votes, and matches you play. We store that score per action type so we can moderate accounts and grant rewards. These scores are not shown on public player pages;
- the rewards you unlocked and when you unlocked them. Rewards are images with a title and description that staff create; we unlock them automatically when your account meets their conditions, using data we already hold for other features: your matches on every Steam ID on your account (result, faction, mode, map, duration, lobby rating, and your community ELO), matches your app recorded, comments and replies, votes you cast and receive, replays you upload or download and the votes and downloads they receive, your reputation, whether your profile has an avatar, bio, background and link, how long your account exists, your total Company of Heroes streaming time, the number of matches with fair play checks, and whether you published a stream overlay. We do not collect anything new for rewards. This includes matches recorded before a reward existed. Unlocked rewards and their unlock dates are shown on your public player page on the website and in the desktop app; your progress toward rewards you have not unlocked yet is only shown to you.

Website login keeps you signed in with a PocketBase session cookie in your browser. Steam login sends you to Steam to prove your identity; we store the resulting Steam ID on your account and do not receive your Steam password. While a Steam login is in progress we set a short-lived cookie (10 minutes) so the login can only finish in the browser that started it.

When you log in with Steam in the desktop app, the app opens that same Steam login in your browser. Afterwards the website sends a short-lived login code (valid for 5 minutes) to the app on your own computer (`localhost`), and the app exchanges it for a session. The app keeps that session token in its settings on your device, and in the settings backups it writes to your Documents folder, so you stay signed in; it renews the token while it runs. Signing out in the app removes it.

The desktop app links the Steam ID it sees in your game to your account. If that Steam ID already belongs to another account, we do not link it; instead we record the request (your account, the Steam ID, and the accounts that already use it) so staff can review it and, if the accounts belong to the same person, merge them. Staff can see these requests together with the names, Steam IDs, roles, and last login of the accounts involved.

You can update your display name, avatar, email, and password on the website and in the desktop app. When you verify an email or change to a new one, we send a one-time confirmation message to that address so only you can complete the change. We do not use those messages for marketing.

If you link a Steam ID to your account, you can also customize your **public player profile**: an optional bio, links (for example Twitch, YouTube, or other URLs), and an optional background image. That customization is stored with your Steam ID and shown on your public player page on the website and in the desktop app. When you connect Twitch or YouTube on the desktop app's Streaming page, we add that channel's link to your profile automatically (you can still edit or remove it).

### b) Match, replay, and community data

To provide match history, scouting, leaderboards, and player pages we store:

- lobby and match records (map, mode, duration, outcome, ratings);
- player identities seen in those matches (Steam ID, Relic profile ID, in-game alias, country when Relic provides it);
- community ELO and performance stats we derive from matches;
- replay files you upload, including metadata, a description (required for member uploads; optional for personal library uploads), and in-game chat captured in the replay (personal library uploads stay private by default; member uploads you choose to publish are public). If you own a member upload, you can edit its title, description, and linked Steam IDs (we rebuild the ladder-stats snapshot when Steam links change). Soft-deleting a member upload hides it from the public catalog and lists; we keep the file and metadata so staff can still review it;
- comments, likes, up/down votes on comments, replays, and player profiles, and similar social actions on matches, including @mentions of other app users by display name;
- a public net vote score on player profiles (upvotes minus downvotes); voting on a player requires an account;
- overlay and notification data needed to run those features.

Game logs such as `warnings.log` are read **on your device** so the app can detect matches. We store the match data that results, not the full log file, unless you explicitly upload a file.

### c) Public player pages, leaderboards, and replays

The website and API publish ranked stats, match history, performance breakdowns, community replays, live matches that companion users are in, a public catalog of Company of Heroes Twitch streams, and (where available) Steam profile details such as avatar, alias, online/last-seen status, and playtime. Player pages may also show optional profile customization you choose to publish (bio, links, and background image). That information comes from Relic and Steam public multiplayer/profile APIs, from matches recorded by the community, from the desktop companion while a user is in a game, from Twitch’s public stream API, and from profile fields you save when logged in.

The homepage lists those live companion lobbies (map, players, and host display name), current CoH streams, the most downloaded replays of the week, recent community matches with a replay, and latest **member replay** uploads. The homepage and the **Statistics** page also show aggregate figures from finished community matches (ranked automatch, Basic Matches and skirmishes) (maps played, faction and matchup win rates, match counts) plus a few highlights such as the most active player (alias and number of matches) and the longest match. For those statistics we also read the stored community replay files on our servers and keep a short summary per match: for each human player the faction, doctrine, units and upgrades ordered, and the first unit built (no names or chat). Only totals across all matches are shown (doctrine pick and win rates, most built units, openings, popular upgrades). Replays uploaded to our servers count towards the same totals, including those in a personal replay library: we read the stored file and keep the same kind of short summary, and use the map, start time and player names in the replay only to recognise a game that is already counted. Uploaded replays are never shown individually through the statistics, and a personal library otherwise stays private. Hidden matches and deleted uploads are left out. Player pages list the public community matches and member replays that player appears in. On the website we also show community matches that include a replay file, and member replays that an account holder explicitly uploads or publishes: map and player metadata, a required description, in-game chat parsed from the replay, action timelines, and a download of the `.rec` file. When a member replay includes Steam IDs, we store a snapshot of each player’s current Relic ladder stats at publish time (rating, country, wins/losses, streak, and rank/level for the match mode) so Overview stays fixed for that upload (those fields are not refreshed later from live stats; editing Steam links on an upload rebuilds that snapshot). Account holders can also publish one of their own community matches (a finished lobby with a replay file) into **Member replays**; we copy that replay into the member catalog and stop listing that match under Community matches (it remains under My matches for the owner). Soft-deleted member uploads are hidden from public pages and lists; staff can still open them for moderation. A signed-in player who took part in a saved match can also upload the replay file for it on the website when the match has none yet; we keep the longer (or larger) file, just as when the desktop app attaches it. Public downloads of those files are counted and shown on replay pages and in replay lists. Community match pages also show community comments and up/down votes; posting a comment, voting on a comment, or voting on a community match replay requires an account. Player profile pages also show a net community vote score; voting on a player requires an account. If you delete a comment we keep it for moderation: other users no longer see the text (they may see “Comment has been deleted” when replies remain). Staff can still see the original comment, a staff-only deleted badge, and, when a moderator removed it, the reason they entered. To keep those counts honest we store a one-way hash of the download request (network address and an anonymous browser token in local storage) and ignore repeat clicks from the same visitor. We do not use that hash to identify you. We also limit how often a network address can fetch replay files so the Service stays available. We do not publish personal playback-folder libraries unless you explicitly upload or publish a replay to **Member replays**. Hidden matches stay off those public listings.

Staff can hide match results from those public listings (for example during a tournament), either one match at a time or by a word list that matches Relic lobby names. Hidden matches stay visible to staff in the desktop app and on the website so they can restore them or change the word list. Relic’s own APIs are unchanged and may still show the same match.

We may also show smurf / related-account labels when our systems link Steam accounts that appear to be used together. To do this we check public Steam data for players seen in matches. That includes asking Steam's public Web API, while a match is running, whether the game is borrowed through Steam Family Sharing and from which Steam account. We store the result (lending Steam ID, ownership, and a screening score) with that player's Steam ID.

Player pages also show whether the player's Steam account has VAC or game bans on record: the number of each and how many days ago the last one was issued. We read this from Steam's public Web API when the page loads and only cache it for a few minutes; we do not store it with the profile.

Staff can attach public badges (for example Premium or Streamer) to Relic/Steam player identities. We store those assignments (Steam ID, Relic profile ID, and an alias snapshot) so the badges can be shown next to in-game names in the desktop app and on the public website.

The documentation pages on the website (units, buildings, commanders and weapons) show game data read from the Company of Heroes game files. Staff can add a public tip to each page; we store the tip text with the staff account that last edited it. Signed-in users can report wrong information on a page: we store the report text, the page it was sent from, and your account, and notify admins and moderators so they can fix it. Reports are only visible to staff. Visitors' use of these pages is not stored.

Staff (admins and moderators) and community hosts can run 1v1 **tournaments** on the website and in the desktop app. When you sign up for a tournament we store your account, the Steam ID you choose from your linked accounts, and the Relic profile ID and alias we already have for that Steam ID. To seed the bracket we read that player's stored 1v1 rating. Tournament pages are public: they show every player's alias, seed, rating at seeding, matches, scores and final place, and link to the community matches that counted as tournament games. A tournament you win also shows as a trophy on your public player profile. Scores come from tournament games: when you click "Start tournament game" in the desktop app, we store that your next lobby with your opponent is the game (its Relic session ID, your account and the match). Until the tournament ends or is cancelled, that game is hidden from public match lists, live lobbies and the tournament page; you, your opponent and staff can still open it and its replay. Its result comes from Relic, as for every recorded match, and we remember which processed games and which tournament starts you have already seen, so each popup shows once. Staff set a deadline per round; matches past their deadline are reported to staff, who can set a result by hand, give a new deadline or disqualify a player. Each tournament has a public Updates tab with posts by staff and automatic posts when the rules or start time change, a player is disqualified (with their alias), or the tournament starts, ends or is cancelled. Participants get an in-app notification for every update and for personal events: signing up, a reminder before the start, their next match being ready, a result set by staff, being knocked out or disqualified, and their final place; we store when these went out and which update popups you have seen. The desktop app can also show these tournament notifications as Windows notifications while it is in the background; that happens on your computer only. When a tournament has rules, you accept them when you sign up, and again after staff change them; we store when you last accepted. You and your opponent can propose and accept times for your match: we store the proposed times, who proposed them, the agreed time, and when a reminder went out, and the agreed time shows on the public bracket. If you report a problem with your match, we store your report (reason, the text you write, your account and the match) and staff receive it as a notification. Staff mark it resolved or dismissed and may add a note; you get that note as a notification. Reports are only visible to you and staff. Staff can add a stream link and put one match in the spotlight on the tournament page, and the page shows which matches are being played right now (not their score). Once a tournament is over, its page shows statistics from the counted games (factions, maps, game lengths) and the tournament appears in a public hall of fame with the aliases of its top three players. Registration closes automatically at the closing time staff set. The notification bell on the website shows the same notifications as the desktop app. You can withdraw until the tournament starts; after that your results stay part of the tournament. You can ask to become a **tournament host**: we store your request (the text you write, the Discord name you give, if any, and your account), and staff see it with your display name and receive it as a notification. Staff approve or decline it and may add a note, which you get as a notification; we store who handled it and when. An approved request gives your account the host role, which lets you create tournaments and run the ones you created. A tournament run by a host shows that host's display name on its public page. Staff can take the role away again; your tournaments then stay on the site and staff run them.

The **Streamer** badge is also granted automatically. While you are live on a connected Twitch or YouTube channel **and** Company of Heroes is running, the desktop app counts that time and sends it to our servers with your account, together with your Twitch login and YouTube channel ID. After 12 hours in total, every Steam ID on your account gets the public Streamer badge. We store only the total time, when it was last reported, and those channel identifiers; we do not store stream video, titles, or viewer data for this.

### d) Fair play checks (desktop app)

Fair play checks are **on by default** and can be turned off in Settings. While they are enabled, during a match the app may:

- ask Company of Heroes to save its own screenshot (the same Print Screen file it writes under My Games) **only while the game is in the foreground**, then upload that image for review and analysis. If the game does not write a file, we capture the Company of Heroes window instead. These images can include other players’ in-game names and units. We do not capture the Windows desktop, the clipboard, the taskbar, or other applications;
- check running process names against a denylist and report a match (process name and process id);
- inspect modules loaded into the Company of Heroes process and report **unknown** DLLs (module name and full path, plus process id) that are not under Windows system folders, the game install folder, Steam, common GPU vendor paths, or a staff-maintained allowlist. We do not upload the full list of system modules;
- open all-chat in Company of Heroes and type a short local message (visible to other players in that match) saying the player is supervised by coh1stats.com and is not using cheats, **only if you turn on** the all-chat announce setting (off by default). We do not upload that message; it can still appear in replays other people save;
- store reports and a staff-maintained list of flagged Steam IDs.

### e) Settings and optional integrations

Settings, Twitch and YouTube tokens, overlay config, and API keys you enter (for example an ElevenLabs key for TTS) are stored **on your device** unless a feature needs to publish something to our servers (for example a stream overlay or your Streamer badge progress). The settings backups the app writes to your Documents folder leave out Twitch and YouTube tokens and API keys (they do include your app account login, so a backup can restore your account).

The desktop app looks up Steam profiles (avatar, alias, recently played time) and the current Company of Heroes player count through our website, which adds our Steam Web API key. We pass the Steam IDs on to Steam and may cache Steam's answer for a few minutes; we do not store those lookups.

If you connect Twitch, Twitch provides the account information needed to run chat, rewards, and overlays. If you connect YouTube, sign-in goes through our website so we can exchange Google's authorization code for tokens (the Google client secret stays on our servers and is never shipped in the app). We pass those tokens back to your device in a short-lived handoff and do not keep them; after that, Google provides your channel name, handle, and avatar to the app, and the app reads your YouTube Live chat (for TTS) and posts bot messages to it directly from your device — we do not receive that chat. If you use ElevenLabs, chat text is sent to ElevenLabs with **your** key; we do not keep that key on our servers.

The separate **Replay Manager** desktop app works entirely on your device. It reads the `.rec` files in your Company of Heroes playback folder, keeps its settings and a cache of parsed replay details in its own app data folder, and only changes files when you rename or delete a replay. It has no account and sends nothing to our servers. On startup it asks GitHub whether a newer version of the Replay Manager exists; it only downloads and installs one when you click **Install and restart**. When you click **Download companion** it asks GitHub for the latest Companion app installer and opens that download in your browser.

### f) Technical data

We keep basic operational data such as app version, authentication/session tokens, and request logs needed to run and secure the Service.

## 3. How we use information

We use information to:

- create and manage accounts, and keep you signed in;
- provide match tracking, history, replays (including the public community replay browser), live companion lobbies, Twitch stream listings, leaderboards, and player pages;
- sync data across the app, website, and API;
- operate overlays, notifications (including comment, reply, @mention, and reward unlock alerts), and other features you enable;
- unlock rewards when your account meets their conditions, and show the rewards you unlocked on your public player page;
- review fair play reports and protect the community from abuse;
- keep comments that users or staff remove so moderators can review the text and the reason it was deleted;
- hide match results from public listings when staff need to (for example during a tournament), including by lobby-name word list;
- run tournaments: show who signed up, seed players by their rating, fill in match scores from the tournament games players started, hide those games until the tournament ends, and remind players and staff of deadlines;
- show staff-assigned public badges next to Relic player names in the desktop app and on the website, and grant the Streamer badge after 12 hours of Company of Heroes streaming, and show that badge in green while you are streaming (based on the streaming reports the desktop app sends, which are public only as "this Steam ID is streaming right now");
- debug, maintain, and improve the Service;
- comply with legal obligations.

## 4. Legal bases (where applicable)

Depending on your location, we process personal data under one or more of:

- **contract** — to provide the app features you use;
- **legitimate interests** — to operate public leaderboards and match records, keep the Service secure, and review fair play reports;
- **consent** — where you connect a third-party account (including Steam login), or keep a setting enabled (you can disconnect or turn it off);
- **legal obligations**.

Publishing Relic/Steam multiplayer stats is how the website works. If you want a player page taken down or corrected, contact us.

## 5. How we share information

We share information with:

- **Steam (Valve)** and **Relic Entertainment / SEGA** — to look up profiles, ranks, and match history, and (when you choose Log in with Steam) to authenticate your Steam identity via Steam OpenID;
- **Twitch** — if you connect Twitch, and to list public Company of Heroes streams on the website;
- **Google (YouTube)** — if you connect YouTube, to sign you in (via our website OAuth exchange) and so the app can read and post to your YouTube Live chat on your device;
- **ElevenLabs** — if you use TTS with your own API key;
- **Cloudflare** — to host and deliver the website;
- staff moderators who review fair play reports, who can hide match results from public listings (including by lobby-name word list), who can hide fair-play screenshots from player views while still reviewing them, who can attach public badges to Relic/Steam player identities, and who can see comments marked as deleted together with the reason a moderator entered;

Match results, player identities, and stats may be **public** on the website and API, except where staff have hidden a match from those listings. Replay files, comments, and similar content you post may be visible to other users of the Service. Comments you or staff remove stay stored for moderation and are hidden from the public view.

We may also disclose information if required by law, or to protect the Service and other players.

## 6. Data retention

We keep account, match, replay, and stats data for as long as the Service needs them, including for history, leaderboards, security, and legal reasons.

You can ask us to delete or correct your **account** data. Match records that include other players, public leaderboard rows, and fair play evidence may be retained or only partly removed so history for everyone else stays accurate. Comments marked as deleted are kept so staff can review them and the reason they were removed. Fair-play screenshots staff hide stay stored for moderation and are hidden from player views.

Local settings are stored on your device until you clear app data. External backups the app writes on your computer stay under your control.

## 7. Security

We apply reasonable technical and organizational safeguards. No system is completely secure, and we cannot guarantee absolute security.

## 8. Your privacy rights

Depending on your jurisdiction, you may have rights to:

- access, correct, or delete personal data;
- object to or restrict certain processing;
- withdraw consent (where processing is based on consent);
- request data portability;
- lodge a complaint with a regulator (in the EU/EEA, your local data protection authority).

To use these rights, email us. We may need to verify that the request is yours.

## 9. Children’s privacy

The Service is not directed to children under 16 (or the higher age required where you live). Company of Heroes is a game for older players. We do not knowingly collect personal data from children. If you believe a child has given us data, contact us and we will delete it.

## 10. International transfers

The website is hosted on Cloudflare. The API and databases run on our backend. Your data may be processed in the Netherlands and in other countries where those providers operate. Where required, we rely on appropriate safeguards for those transfers.

## 11. Changes to this policy

We may update this policy from time to time. The current version is posted at [https://coh1stats.com/privacy](https://coh1stats.com/privacy) with a revised effective date.

## 12. Contact

For privacy requests or questions:

- **Email:** [richard@codeit.ninja](mailto:richard@codeit.ninja)

By using the Service, you acknowledge this Privacy Policy.
