<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { useHost } from '../host/host.context';
	import { Alert } from '../ui/alert';
	import { Button } from '../ui/button';
	import PlayerSearchCard from './player-search-card.svelte';
	import type { PlayerSearchPage, PlayerSearchResult } from './types';

	type Props = {
		/** Trimmed name; key the component on it so a new search starts over. */
		query: string;
		/** First page when the host already has it (website SSR); fetched otherwise. */
		initial?: PlayerSearchPage | null;
	};

	let { query, initial = null }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// Seeded once: the parent keys this component on the query.
	const first = untrack(() => initial);
	let items = $state<PlayerSearchResult[]>(first?.items ?? []);
	let total = $state(first?.total ?? 0);
	let more = $state(first?.more ?? false);
	let page = $state(first ? 1 : 0);
	let loading = $state(false);
	let failed = $state(false);
	let error = $state<string | null>(null);

	async function loadNext() {
		if (loading || (page > 0 && !more)) {
			return;
		}

		loading = true;
		failed = false;
		try {
			const next = await host.api.players.searchPage(query, page + 1);
			const seen = new Set(items.map((player) => player.profileId));
			items = [...items, ...next.items.filter((player) => !seen.has(player.profileId))];
			total = next.total;
			more = next.more;
			page += 1;
		} catch (cause) {
			if (page === 0) {
				error = cause instanceof Error ? cause.message : 'Failed to search for player';
			} else {
				failed = true;
			}
		} finally {
			loading = false;
		}
	}

	if (!first) {
		void loadNext();
	}

	/** Loads the next page when the end of the list scrolls into view. */
	const nearEnd: Attachment<HTMLElement> = (node) => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !failed) {
					void loadNext();
				}
			},
			{ rootMargin: '400px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	};
</script>

{#if error}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{t(error)}</Alert>
	</div>
{:else if page === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{t('Loading…')}</p>
{:else}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{total === 1
			? t('{count} player found', { count: total })
			: t('{count} players found', { count: total })}
	</p>
	{#if items.length === 0}
		<p class="text-secondary-400 px-4 py-3 text-sm">{t('Player not found')}</p>
	{:else}
		<div>
			{#each items as player (player.profileId)}
				<PlayerSearchCard {player} />
			{/each}
		</div>
		{#if more}
			{#if failed}
				<div class="px-4 py-3">
					<Button variant="secondary" onclick={loadNext}>{t('Load more')}</Button>
				</div>
			{:else}
				{#key page}
					<p {@attach nearEnd} class="text-secondary-400 px-4 py-3 text-sm">{t('Loading…')}</p>
				{/key}
			{/if}
		{/if}
	{/if}
{/if}
