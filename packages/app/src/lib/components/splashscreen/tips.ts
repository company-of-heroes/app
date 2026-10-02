/** i18n keys for the rotating "Did you know?" tips on the splashscreen. */
export const SPLASH_TIPS = [
	'Every match you play is saved to your history, so you can review it later.',
	'Upload your replays to share them with other players on coh1stats.com.',
	'Possible smurf accounts are labelled next to player names.',
	'Add a Twitch overlay to show your current match on stream.',
	'The Twitch bot can answer chat commands about the game you are playing.',
	'Open the live page to see which matches are being played right now.',
	'Check the leaderboards to see how you rank against other players.',
	'Set up keyboard shortcuts to control the app while you are in game.'
] as const;

/** How long each tip stays visible (ms). */
export const SPLASH_TIP_MS = 6000;
