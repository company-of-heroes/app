<script lang="ts">
	import { useHost } from '../host/host.context';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive } from '@company-of-heroes/ui/variants';
	import { getRaceLabel } from '../format/player-format';
	import { tooltip } from '../attachments/tooltip.svelte';
	import type { LiveLobbyPlayerStats } from '../live-lobby/types';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import type { PlayerFactionPreview } from '../player/types';

	export type TeamSkillPlayer = {
		race: number | null;
		alias: string;
		steamId?: string | null;
		profileId?: number | null;
		stats?: LiveLobbyPlayerStats | null;
		href?: string | null;
		avatarUrl?: string | null;
		country?: string | null;
	};

	type Props = {
		players: TeamSkillPlayer[];
		meSteamIds?: string[];
		highlightedPlayers?: string[];
		levelFallback?: string;
		outcome?: 'win' | 'loss' | null;
		modeLabel?: string | null;
		resolveRaceLabel?: (race: number) => string;
		/** When false, show faction flags instead of rank badges (stats still pass to previews). */
		showRankBadges?: boolean;
	};

	type Chip = {
		key: string;
		href: string | null;
		previewId: string | null;
		label: string;
		ranked: boolean;
		src: string;
		levelText: string | null;
		className: string;
		iconClass: string;
		preview: PlayerFactionPreview;
		focus: boolean;
	};

	const host = useHost();

	let {
		players,
		meSteamIds = [],
		highlightedPlayers = [],
		levelFallback = '-',
		outcome = null,
		modeLabel = null,
		resolveRaceLabel = getRaceLabel,
		showRankBadges = true
	}: Props = $props();

	function playerKey(player: TeamSkillPlayer, index: number) {
		if (player.profileId != null && player.profileId > 0) {
			return `p:${player.profileId}`;
		}

		if (player.steamId) {
			return `s:${player.steamId}`;
		}

		return `i:${index}`;
	}

	/**
	 * The signed-in player's own accounts (gold) or a player the list is filtered on
	 * or about (blue). Your own accounts always stay gold, also on your own profile.
	 */
	function focusOf(player: TeamSkillPlayer): 'filtered' | 'me' | null {
		if (player.steamId && meSteamIds.includes(player.steamId)) {
			return 'me';
		}

		return isFiltered(player) ? 'filtered' : null;
	}

	function isFiltered(player: TeamSkillPlayer) {
		if (!highlightedPlayers.length) {
			return false;
		}

		const ids = [
			player.profileId != null ? String(player.profileId) : '',
			player.steamId || ''
		].filter(Boolean);

		if (ids.some((id) => highlightedPlayers.includes(id))) {
			return true;
		}

		const alias = player.alias.trim().toLowerCase();
		return Boolean(alias && highlightedPlayers.some((entry) => entry.toLowerCase() === alias));
	}

	function tipLabel(player: TeamSkillPlayer) {
		const parts = [player.alias.trim() || undefined];
		const level = player.stats?.rankLevel;
		if (level != null && level > 0) {
			parts.push(`Lv ${level}`);
		}

		const rank = player.stats?.rank;
		if (rank != null && rank > 0) {
			parts.push(`#${rank}`);
		}

		return parts.filter(Boolean).join(' · ');
	}

	/** Filtered players get a blue tile; your own accounts are marked on the icon instead. */
	function tileClass(kind: 'filtered' | 'me' | null) {
		const plain = kind !== 'filtered';
		return cn(
			'group inline-flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md transition-colors',
			kind === 'filtered' && 'bg-blue-800/30',
			plain && outcome === 'win' && 'bg-green-500/5 hover:bg-green-500/10',
			plain && outcome === 'loss' && 'bg-red-500/5 hover:bg-red-500/10',
			plain &&
				outcome !== 'win' &&
				outcome !== 'loss' &&
				'bg-secondary-900/60 hover:bg-secondary-800/50'
		);
	}

	function toChip(player: TeamSkillPlayer, index: number): Chip {
		const kind = focusOf(player);
		const focus = kind !== null;
		const ranked = Boolean(showRankBadges && player.stats);
		const level = player.stats?.rankLevel ?? 0;
		const ranking = player.stats?.rank ?? 0;
		const rankSrc = ranked ? host.resolve.rankImageByRace(player.race ?? 0, level) : null;
		const src = rankSrc ?? host.resolve.factionFlagByRace(player.race ?? 0);
		const href = player.href ?? null;

		return {
			key: playerKey(player, index),
			href,
			previewId: href ? playerPreviewId(player) : null,
			label: tipLabel(player),
			ranked,
			src,
			levelText: ranked ? (ranking > 0 ? `#${ranking}` : levelFallback) : null,
			className: cn(href && interactive, tileClass(kind)),
			iconClass: cn(
				focus ? 'opacity-100 grayscale-0' : 'opacity-70 grayscale-50',
				// Your own accounts: gold ring on a faction icon, gold glow on a rank icon.
				kind === 'me' && (ranked ? 'drop-shadow-[0_0_6px_var(--color-primary)]' : 'ring-primary'),
				'group-hover:opacity-100 group-hover:grayscale-0'
			),
			preview: {
				alias: player.alias,
				race: player.race,
				modeLabel,
				raceLabel: player.race != null ? resolveRaceLabel(player.race) : null,
				avatarUrl: player.avatarUrl,
				country: player.country,
				stats: player.stats,
				rankImageSrc: rankSrc,
				factionFlagSrc: host.resolve.factionFlagByRace(player.race ?? 0)
			},
			focus
		};
	}

	const chips = $derived(players.map(toChip));
</script>

{#snippet chipBody(chip: Chip)}
	<img
		src={chip.src}
		alt={chip.ranked ? '' : chip.label}
		class={cn(
			chip.ranked ? 'size-5' : factionIcon,
			chip.iconClass,
			!chip.ranked && 'transition-all'
		)}
	/>
	{#if chip.levelText}
		<span
			class={cn(
				'text-[11px] leading-none tabular-nums',
				chip.focus ? 'text-white' : 'text-secondary-300 group-hover:text-white'
			)}
		>
			{chip.levelText}
		</span>
	{/if}
{/snippet}

<span class="inline-flex items-center gap-1">
	{#each chips as chip (chip.key)}
		{#if chip.href && chip.previewId}
			<PlayerProfileLink
				href={chip.href}
				playerId={chip.previewId}
				preview={chip.preview}
				class={chip.className}
			>
				{@render chipBody(chip)}
			</PlayerProfileLink>
		{:else if chip.href}
			<a href={chip.href} class={chip.className} {@attach tooltip(chip.label)}>
				{@render chipBody(chip)}
			</a>
		{:else}
			<span class={chip.className} {@attach tooltip(chip.label)}>
				{@render chipBody(chip)}
			</span>
		{/if}
	{/each}
</span>
