<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import ShareNetworkIcon from 'phosphor-svelte/lib/ShareNetworkIcon';
	import { Button } from '../ui/button';
	import ReplayTable from '../replay/replay-table.svelte';
	import type { CommunityMatch, ReplayLayout } from '../replay/types';
	import DiscoverSectionHeader from './discover-section-header.svelte';
	import ReplayCardGrid from './replay-card-grid.svelte';
	import type { ReplayPage } from './types';

	type Props = {
		initial: ReplayPage;
		/** Next pages of shared replays, newest first. */
		loadMore: (page: number) => Promise<ReplayPage>;
		uploadHref: string;
		meSteamIds?: string[];
		layout?: ReplayLayout;
	};

	const { t } = useI18n();

	let { initial, loadMore, uploadHref, meSteamIds = [], layout = 'grid' }: Props = $props();

	let extra = $state.raw<CommunityMatch[]>([]);
	let page = $state(1);
	let totalPages = $derived(initial.totalPages);
	let loading = $state(false);
	let failed = $state(false);

	/** New uploads shift pages, so a later page can repeat an earlier row. */
	const items = $derived(
		[...initial.items, ...extra].filter(
			(match, index, all) => all.findIndex((other) => other.id === match.id) === index
		)
	);
	const hasMore = $derived(page < totalPages);

	async function more() {
		if (loading) {
			return;
		}

		loading = true;
		failed = false;
		try {
			const next = await loadMore(page + 1);
			extra = [...extra, ...next.items];
			page = next.page;
			totalPages = next.totalPages;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}
</script>

<section>
	<DiscoverSectionHeader
		title={t('Latest shared')}
		description={t('Replays players uploaded for everyone to watch')}
	/>
	{#if items.length === 0}
		<div class="flex flex-col items-center gap-3 px-4 py-14 text-center">
			<ShareNetworkIcon class="text-secondary-600 size-10" weight="duotone" />
			<p class="font-medium text-white">{t('No shared replays yet')}</p>
			<p class="text-secondary-400 max-w-md text-sm">
				{t('Be the first: upload a replay and let the community watch your best game.')}
			</p>
			<Button href={uploadHref} variant="primary">
				<UploadSimpleIcon class="size-4" />
				{t('Share replay')}
			</Button>
		</div>
	{:else}
		{#if layout === 'list'}
			<ReplayTable matches={items} {meSteamIds} closing={!hasMore} />
		{:else}
			<ReplayCardGrid matches={items} {meSteamIds} closing={!hasMore} />
		{/if}
		{#if hasMore}
			<div class="flex flex-col items-center gap-2 px-4 py-5">
				<Button variant="secondary" onclick={() => void more()} {loading}>
					{t('Load more')}
				</Button>
				{#if failed}
					<p class="text-sm text-red-300">{t('Could not load more replays. Try again.')}</p>
				{/if}
			</div>
		{/if}
	{/if}
</section>
