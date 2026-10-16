<script lang="ts">
	import RankIcon from '../player/rank-icon.svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { Button } from '@company-of-heroes/ui/button';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import CrosshairIcon from 'phosphor-svelte/lib/CrosshairIcon';
	import { useHost } from '../host/host.context';
	import { useLeaderboard } from './context';
	import LeaderboardChange from './leaderboard-change.svelte';
	import LeaderboardPanel from './leaderboard-panel.svelte';
	import LeaderboardRecord from './leaderboard-record.svelte';

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	const user = $derived(host.auth.user);
	const line = $derived(leaderboard.ownRow ?? leaderboard.ownStat);
</script>

<LeaderboardPanel title={t('Your position')}>
	<div class="px-4 pb-4">
		{#if !user}
			<p class="text-secondary-400 mb-3 text-sm">
				{t('Sign in with Steam to see where you stand on every ladder.')}
			</p>
			<Button href={host.routes.login()} variant="secondary" size="sm">
				{t('Sign in')}
			</Button>
		{:else if user.steamIds.length === 0}
			<p class="text-secondary-400 text-sm">
				{t('Link your Steam account to see your position.')}
			</p>
		{:else if leaderboard.loading || (!line && leaderboard.ownStatLoading)}
			<Skeleton class="mb-2 h-9 w-24" />
			<Skeleton class="h-4 w-full" />
		{:else if line}
			<div class="flex items-end justify-between gap-3">
				<div>
					<div class="text-primary font-heading text-4xl leading-none font-bold tabular-nums">
						#{line.rank}
					</div>
					<div class="text-secondary-400 mt-1 text-xs">
						{leaderboard.ownRow ? t('Top 200') : t('Outside the top 200')}
					</div>
				</div>
				<RankIcon
					level={line.ranklevel}
					leaderboardId={leaderboard.boardId}
					position={line.rank}
					class="size-auto h-12"
				/>
			</div>
			{#if leaderboard.ownRow}
				{@const change = leaderboard.ownRow.change}
				<dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
					<div class="bg-secondary-950/60 rounded-md px-3 py-2">
						<dt class="text-secondary-500 text-xs">{t('Since yesterday')}</dt>
						<dd><LeaderboardChange change={change?.day} /></dd>
					</div>
					<div class="bg-secondary-950/60 rounded-md px-3 py-2">
						<dt class="text-secondary-500 text-xs">{t('Since last week')}</dt>
						<dd><LeaderboardChange change={change?.week} period="week" /></dd>
					</div>
				</dl>
			{/if}
			<LeaderboardRecord wins={line.wins} losses={line.losses} class="mt-3" />
			{#if leaderboard.ownRow}
				{@const profileId = leaderboard.ownRow.profile.profile_id}
				<Button
					variant="secondary"
					size="sm"
					class="mt-3 w-full justify-center"
					onclick={() => leaderboard.jumpTo(profileId)}
				>
					<CrosshairIcon class="size-4" />
					{t('Jump to me')}
				</Button>
			{/if}
		{:else}
			<p class="text-secondary-400 text-sm">{t('You have no rank on this ladder yet.')}</p>
		{/if}
	</div>
</LeaderboardPanel>
