# Privacy Policy

**Effective date:** September 7, 2026

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

When you use the desktop app we create or restore an account so your match history can sync. You can also **create an account or log in on the website** with the same email and password, or **log in with Steam** (OpenID). That account may include:

- a display name and avatar (optional);
- one or more Steam IDs (including the Steam ID used when you sign in with Steam);
- an email address — by default a random `@fknoobs.com` placeholder, or your real email **only if you change it**;
- a password hash (for email/password accounts);
- last login time and the app version;
- staff role, if we grant you one;
- a reputation score derived from comments, votes, replay downloads, player profile votes, and matches you play. We store that score per action type so we can moderate accounts and grant rewards later. These scores are not shown on public player pages.

Website login keeps you signed in with a PocketBase session cookie in your browser. Steam login sends you to Steam to prove your identity; we store the resulting Steam ID on your account and do not receive your Steam password.

You can update your display name, avatar, email, and password on the website and in the desktop app. When you verify an email or change to a new one, we send a one-time confirmation message to that address so only you can complete the change. We do not use those messages for marketing.

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

The website and API publish ranked stats, match history, performance breakdowns, community replays, live matches that companion users are in, a public catalog of Company of Heroes Twitch streams, and (where available) Steam profile details such as avatar, alias, online/last-seen status, and playtime. That information comes from Relic and Steam public multiplayer/profile APIs, from matches recorded by the community, from the desktop companion while a user is in a game, and from Twitch’s public stream API.

The homepage lists those live companion lobbies (map, players, and host display name), current CoH streams, recent community matches with a replay, and latest **member replay** uploads. On the website we also show community matches that include a replay file, and member replays that an account holder explicitly uploads or publishes: map and player metadata, a required description, in-game chat parsed from the replay, action timelines, and a download of the `.rec` file. When a member replay includes Steam IDs, we store a snapshot of each player’s current Relic ladder stats at publish time (rating, country, wins/losses, streak, and rank/level for the match mode) so Overview stays fixed for that upload (those fields are not refreshed later from live stats; editing Steam links on an upload rebuilds that snapshot). Account holders can also publish one of their own community matches (a finished lobby with a replay file) into **Member replays**; we copy that replay into the member catalog and stop listing that match under Community matches (it remains under My matches for the owner). Soft-deleted member uploads are hidden from public pages and lists; staff can still open them for moderation. Public downloads of those files are counted and shown on replay pages. Community match pages also show community comments and up/down votes; posting a comment, voting on a comment, or voting on a community match replay requires an account. Player profile pages also show a net community vote score; voting on a player requires an account. If you delete a comment we keep it for moderation: other users no longer see the text (they may see “Comment has been deleted” when replies remain). Staff can still see the original comment, a staff-only deleted badge, and, when a moderator removed it, the reason they entered. To keep those counts honest we store a one-way hash of the download request (network address and an anonymous browser token in local storage) and ignore repeat clicks from the same visitor. We do not use that hash to identify you. We also limit how often a network address can fetch replay files so the Service stays available. We do not publish personal playback-folder libraries unless you explicitly upload or publish a replay to **Member replays**. Hidden matches stay off those public listings.

Staff can hide match results from those public listings (for example during a tournament), either one match at a time or by a word list that matches Relic lobby names. Hidden matches stay visible to staff in the desktop app and on the website so they can restore them or change the word list. Relic’s own APIs are unchanged and may still show the same match.

We may also show smurf / related-account labels when our systems link Steam accounts that appear to be used together.

Staff can attach public badges (for example Premium or Streamer) to Relic/Steam player identities. We store those assignments (Steam ID, Relic profile ID, and an alias snapshot) so the badges can be shown next to in-game names in the desktop app and on the public website.

### d) Fair play checks (desktop app)

Fair play checks are **on by default** and can be turned off in Settings. While they are enabled, during a match the app may:

- ask Company of Heroes to save its own screenshot (the same Print Screen file it writes under My Games) **only while the game is in the foreground**, then upload that image for review and analysis. If the game does not write a file, we capture the Company of Heroes window instead. These images can include other players’ in-game names and units. We do not capture the Windows desktop, the clipboard, the taskbar, or other applications;
- check running process names against a denylist and report a match (process name and process id);
- inspect modules loaded into the Company of Heroes process and report **unknown** DLLs (module name and full path, plus process id) that are not under Windows system folders, the game install folder, Steam, common GPU vendor paths, or a staff-maintained allowlist. We do not upload the full list of system modules;
- open all-chat in Company of Heroes and type a short local message (visible to other players in that match) saying the player is supervised by coh1stats.com and is not using cheats, **only if you turn on** the all-chat announce setting (off by default). We do not upload that message; it can still appear in replays other people save;
- store reports and a staff-maintained list of flagged Steam IDs.

### e) Settings and optional integrations

Settings, Twitch tokens, overlay config, and API keys you enter (for example an ElevenLabs key for TTS) are stored **on your device** unless a feature needs to publish something to our servers (for example a stream overlay).

If you connect Twitch, Twitch provides the account information needed to run chat, rewards, and overlays. If you use ElevenLabs, chat text is sent to ElevenLabs with **your** key; we do not keep that key on our servers.

### f) Technical data

We keep basic operational data such as app version, authentication/session tokens, and request logs needed to run and secure the Service.

## 3. How we use information

We use information to:

- create and manage accounts, and keep you signed in;
- provide match tracking, history, replays (including the public community replay browser), live companion lobbies, Twitch stream listings, leaderboards, and player pages;
- sync data across the app, website, and API;
- operate overlays, notifications (including comment, reply, and @mention alerts), and other features you enable;
- review fair play reports and protect the community from abuse;
- keep comments that users or staff remove so moderators can review the text and the reason it was deleted;
- hide match results from public listings when staff need to (for example during a tournament), including by lobby-name word list;
- show staff-assigned public badges next to Relic player names in the desktop app and on the website;
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
