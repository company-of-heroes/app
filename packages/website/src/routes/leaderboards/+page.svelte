<script lang="ts">
	import { goto } from '$app/navigation';
	import { watch } from 'runed';
	import { LeaderboardPage } from '@company-of-heroes/ui/leaderboard';
	import type { LeaderboardPageData } from '$lib/leaderboards';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	let board = $state.raw<LeaderboardPageData | null>(null);

	watch(
		() => data.board,
		(promise) => {
			promise
				.then((value) => {
					if (data.board === promise) {
						board = value;
					}
				})
				.catch((error) => console.error('[leaderboards] board failed', error));
		}
	);

	function selectBoard(id: number) {
		void goto(href(`/leaderboards?board=${id}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<Seo
	title={t('Leaderboards')}
	ogTitle={t('CoH Leaderboards')}
	description={t('Relic Company of Heroes leaderboards by mode and faction, with companion ELO.')}
/>

<LeaderboardPage boardId={data.boardId} {board} onBoardChange={selectBoard} stickyTop="4rem" />
