<script lang="ts">
	import { untrack } from 'svelte';
	import { LiveStreamsFeed } from '$features/twitch/live-streams.svelte';
	import { LiveStreamTiles } from '@company-of-heroes/ui/twitch';
	import { H } from '$lib/components/ui/h';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const feed = new LiveStreamsFeed();

	$effect(() => {
		untrack(() => {
			void feed.start();
		});
		return () => {
			void feed.stop();
		};
	});
</script>

<div class="overflow-hidden">
	<div class="border-secondary-800 flex items-center justify-between border-b px-4 py-3">
		<H level="6" class="mb-0 font-semibold">{t('Live streams')}</H>
		{#if !feed.isLoading}
			<span class="text-secondary-400 text-sm tabular-nums">
				{t('{count} live', { count: feed.totalItems })}
			</span>
		{/if}
	</div>
	<LiveStreamTiles items={feed.items} loading={feed.isLoading} />
</div>
