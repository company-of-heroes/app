<script lang="ts">
	import { app } from '$core/app/context';
	import { getString } from '$lib/utils/game';
	import { resource } from 'runed';
	import { ReplayList } from '../replays/replay-list.svelte';
	import ReplayFilters from '../replays/replay-filters.svelte';
	import ReplayTable from '../replays/replay-table.svelte';
	import { Alert } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Sheet } from '@company-of-heroes/ui/sheet';
	import { useI18n } from '$lib/i18n';
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';

	interface Props {
		list: ReplayList;
	}

	let { list = $bindable() }: Props = $props();
	const { t } = useI18n();
	let filtersOpen = $state(false);
	const filtersActive = $derived(
		Boolean(list.filters.query.trim()) ||
			list.filters.players.length > 0 ||
			list.filters.maps.length > 0 ||
			list.filters.ranked.value ||
			list.filters.ranked.indeterminate ||
			list.filters.vp.value ||
			list.filters.vp.indeterminate ||
			list.filters.highResources.value ||
			list.filters.highResources.indeterminate
	);
	const playbackDir = resource(
		() => true,
		() => app.paths.cohPlaybackDir()
	);

	$effect(() => {
		if (list.replays.length === 0 && !list.isLoading && list.hasMore) {
			void list.loadMore();
		}
	});

	const aggregation = resource(
		() => app.features.auth.userId,
		async () => {
			const response = await app.pocketbase.send<{
				maps: string[];
				players: { name: string }[];
			}>('/api/replay-filters', {
				method: 'GET',
				query: { userId: app.features.auth.userId }
			});
			return {
				players: response.players ?? [],
				maps: response.maps ?? []
			};
		}
	);

	const mapsList = $derived(
		aggregation.current?.maps.map((m) => ({
			value: m,
			label: getString(m) || m
		})) || []
	);

	const playersList = $derived(
		aggregation.current?.players.map((p) => ({
			value: p.name,
			label: p.name
		})) || []
	);
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<Alert variant="info" size="sm" class="rounded-none border-x-0 border-t-0">
		<p>{t('These replays come from your local Company of Heroes playback folder.')}</p>
		{#if playbackDir.current}
			<p class="mt-1 font-mono text-xs opacity-80">
				{t('Playback folder: {path}', { path: playbackDir.current })}
			</p>
		{/if}
	</Alert>
	<div class="border-secondary-800 flex flex-wrap items-center justify-end gap-3 border-b px-4 py-2">
		<Button href="/replays/upload" size="sm" variant="secondary">
			{t('Upload to Member replays')}
		</Button>
	</div>
	<div class="border-secondary-800 flex items-center justify-end border-b px-4 py-2">
		<Button variant="secondary" size="sm" onclick={() => (filtersOpen = true)}>
			<span class="relative inline-flex">
				<FunnelSimpleIcon class="size-4" />
				{#if filtersActive}
					<span
						class="bg-primary absolute -end-0.5 -top-0.5 size-1.5 rounded-full"
						aria-hidden="true"
					></span>
				{/if}
			</span>
			{t('Filters')}
		</Button>
	</div>
	<div class="min-w-0 flex-1 overflow-auto">
		<ReplayTable {list} />
	</div>
</div>

<Sheet bind:open={filtersOpen} side="left" title={t('Filters')} closeLabel={t('Close')}>
	<ReplayFilters bind:list {mapsList} {playersList} />
</Sheet>
