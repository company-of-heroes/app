<script lang="ts">
	import type { MyTournamentMatch } from '@company-of-heroes/api';
	import { TournamentMyMatch } from '@company-of-heroes/ui/tournament';
	import PlayCircleIcon from 'phosphor-svelte/lib/PlayCircleIcon';
	import { account } from '$core/account';
	import { api, unwrapApi } from '$core/api';
	import { tournamentGames } from '$core/tournaments/tournament-games.svelte';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import WidgetPanel from './widget-panel.svelte';

	const { t } = useI18n();

	let items = $state.raw<MyTournamentMatch[]>([]);

	async function refresh() {
		if (!account.isAuthenticated) {
			items = [];
			return;
		}

		try {
			items = (await unwrapApi(api.tournaments.mine())).matches;
		} catch {
			// Offline: keep the last list.
		}
	}

	// On sign-in, after arming or claiming a game, and every minute (results, deadlines).
	$effect(() => {
		void account.isAuthenticated;
		void tournamentGames.armed;
		void tournamentGames.playingMatchId;
		void refresh();
	});

	$effect(() => {
		const timer = setInterval(() => void refresh(), 60_000);
		return () => clearInterval(timer);
	});
</script>

{#if items.length > 0}
	<WidgetPanel
		title={t('Your tournament match')}
		summary={items.length > 1 ? t('{count} open', { count: items.length }) : undefined}
	>
		<TournamentMyMatch {items} onChange={() => void refresh()}>
			{#snippet start(item)}
				{@const armed = tournamentGames.armed?.matchId === item.match.id}
				{#if item.claim?.status === 'playing' || tournamentGames.playingMatchId === item.match.id}
					<!-- The panel shows "Game in progress". -->
				{:else if armed}
					<div class="flex flex-col items-end gap-1">
						<span class="text-primary text-sm font-medium">
							{t('Waiting for your lobby with {name}...', {
								name: item.opponent?.alias ?? t('your opponent')
							})}
						</span>
						<Button variant="ghost" size="sm" onclick={() => tournamentGames.disarm()}>
							{t('Cancel')}
						</Button>
					</div>
				{:else}
					<Button
						disabled={tournamentGames.busy}
						loading={tournamentGames.busy}
						onclick={() => void tournamentGames.arm(item)}
					>
						<PlayCircleIcon size={18} weight="fill" />
						{t('Start tournament game')}
					</Button>
				{/if}
			{/snippet}
		</TournamentMyMatch>
	</WidgetPanel>
{/if}
