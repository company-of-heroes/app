<script lang="ts">
	import CountryFlag from '../player/country-flag.svelte';
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import PlayerNameIcons from '../player/player-name-icons.svelte';
	import type { LeaderboardStatRow } from '../format/types';
	import { useLeaderboard } from './context';
	import { steamIdOf } from './highlights';

	type Props = {
		stat: LeaderboardStatRow;
		/** Right-hand value (movement, streak). */
		trailing: Snippet;
	};

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	let { stat, trailing }: Props = $props();
</script>

<li>
	<button
		type="button"
		class={cn(
			interactive,
			'hover:bg-secondary-950/50 flex w-full min-w-0 items-center gap-2.5 px-4 py-1.5 text-left text-sm transition-colors',
			leaderboard.isOwn(stat) && 'text-primary'
		)}
		aria-label={t('Show {alias} in the list', { alias: stat.profile.alias })}
		onclick={() => leaderboard.jumpTo(stat.profile.profile_id)}
	>
		<span class="text-secondary-500 w-8 shrink-0 tabular-nums">#{stat.rank}</span>
		<CountryFlag country={stat.profile.country} />
		<PlayerNameIcons labels={stat.profile.labels} steamId={steamIdOf(stat)} />
		<span class="min-w-0 flex-1 truncate font-medium">{stat.profile.alias}</span>
		{@render trailing()}
	</button>
</li>
