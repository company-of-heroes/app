import type { Component } from 'svelte';
import GaugeIcon from 'phosphor-svelte/lib/Gauge';
import FilmStripIcon from 'phosphor-svelte/lib/FilmStrip';
import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwise';
import KeyboardIcon from 'phosphor-svelte/lib/Keyboard';
import TrophyIcon from 'phosphor-svelte/lib/Trophy';
import UsersIcon from 'phosphor-svelte/lib/Users';
import TwitchLogoIcon from 'phosphor-svelte/lib/TwitchLogo';
import dashboardImg from '@assets/screens/dashboard.png';
import replaysImg from '@assets/screens/replays.png';
import historyImg from '@assets/screens/history.png';
import keybindingsImg from '@assets/screens/keybindings.png';
import leaderboardsImg from '@assets/screens/leaderboards.png';
import playersImg from '@assets/screens/players.png';
import twitchImg from '@assets/screens/twitch.png';

export type Feature = {
	id: string;
	title: string;
	description: string;
	image: string;
	imageAlt: string;
	icon: Component;
};

export const features: Feature[] = [
	{
		id: 'dashboard',
		title: 'Dashboard',
		description:
			'Your command center. Live lobbies, recent matches, and quick links into every part of the app.',
		image: dashboardImg,
		imageAlt: 'Company of Heroes Companion dashboard showing live lobbies and recent matches',
		icon: GaugeIcon
	},
	{
		id: 'replays',
		title: 'Replays',
		description:
			'Point it at your replay folder and go. Browse, filter, and open any match for details, chat logs, and analysis.',
		image: replaysImg,
		imageAlt: 'Replay browser with filters and match list',
		icon: FilmStripIcon
	},
	{
		id: 'history',
		title: 'Match history',
		description:
			'Your games and the community’s — searchable, filterable, and one click away from full match breakdowns.',
		image: historyImg,
		imageAlt: 'Match history with search and filters',
		icon: ClockCounterClockwiseIcon
	},
	{
		id: 'keybindings',
		title: 'Keybindings',
		description:
			'Custom shortcuts per faction — USA, Brits, Wehrmacht, Panzer Elite. Record, drag to reorder, export and import.',
		image: keybindingsImg,
		imageAlt: 'Faction keybinding editor',
		icon: KeyboardIcon
	},
	{
		id: 'leaderboards',
		title: 'Leaderboards',
		description:
			'Relic leaderboards by mode and faction. Search players, see the podium, climb the ranks.',
		image: leaderboardsImg,
		imageAlt: 'Relic leaderboards by mode and faction',
		icon: TrophyIcon
	},
	{
		id: 'players',
		title: 'Players',
		description:
			'Look anyone up by name, Steam ID, or Relic profile. Profiles with match history and stats included.',
		image: playersImg,
		imageAlt: 'Player search and profile view',
		icon: UsersIcon
	},
	{
		id: 'twitch',
		title: 'Twitch',
		description:
			'Connect your channel and stream with purpose: TTS, bot commands, and OBS-ready Opponent Bot overlays on api.coh1stats.com.',
		image: twitchImg,
		imageAlt: 'Twitch integration with TTS and overlay settings',
		icon: TwitchLogoIcon
	}
];
