import type { Component } from 'svelte';
import GaugeIcon from 'phosphor-svelte/lib/GaugeIcon';
import FilmStripIcon from 'phosphor-svelte/lib/FilmStripIcon';
import KeyboardIcon from 'phosphor-svelte/lib/KeyboardIcon';
import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
import TwitchLogoIcon from 'phosphor-svelte/lib/TwitchLogoIcon';
import dashboardImg from '@assets/screens/dashboard.png';
import replaysImg from '@assets/screens/replays.png';
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
			'Your profile, today’s matches, and live lobbies from other companion users. Open replays or the current game from here.',
		image: dashboardImg,
		imageAlt: 'Companion dashboard with profile, today’s matches, and live lobbies from other users',
		icon: GaugeIcon
	},
	{
		id: 'replays',
		title: 'Replays',
		description:
			'Your local replays and the community catalog in one place. Filter the list, then open a match for overview, chat, timeline, and screenshots.',
		image: replaysImg,
		imageAlt: 'Replay browser with filters, match list, and parsed replay details',
		icon: FilmStripIcon
	},
	{
		id: 'keybindings',
		title: 'Keybindings',
		description:
			'Global shortcuts plus per-faction binds for USA, Brits, Wehrmacht, and Panzer Elite. Record, drag to reorder, export and import.',
		image: keybindingsImg,
		imageAlt: 'Global and faction keybinding editor',
		icon: KeyboardIcon
	},
	{
		id: 'leaderboards',
		title: 'Leaderboards',
		description:
			'Official Relic boards for 1v1–4v4 and each faction, with rank, ELO, and win/loss. Search a player and open their profile.',
		image: leaderboardsImg,
		imageAlt: 'Relic leaderboards by mode and faction with rank and ELO',
		icon: TrophyIcon
	},
	{
		id: 'players',
		title: 'Players',
		description:
			'Look anyone up by name, Steam ID, or Relic profile. Ranks, ELO, performance, match history, and smurf labels.',
		image: playersImg,
		imageAlt: 'Player search and profile with ranks, ELO, and match history',
		icon: UsersIcon
	},
	{
		id: 'twitch',
		title: 'Twitch',
		description:
			'Connect your channel for TTS, auto player-stat chat messages, and an OBS Opponent Bot overlay hosted on api.coh1stats.com.',
		image: twitchImg,
		imageAlt: 'Twitch TTS, player-stat chat messages, and OBS overlay settings',
		icon: TwitchLogoIcon
	}
];
