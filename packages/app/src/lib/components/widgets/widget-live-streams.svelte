<script lang="ts">
	import { untrack } from 'svelte';
	import { LiveStreamsFeed } from '$features/twitch/live-streams.svelte';
	import { LiveStreamTiles } from '@company-of-heroes/ui/twitch';
	import { Button } from '$lib/components/ui/button';
	import WidgetPanel from './widget-panel.svelte';
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

<WidgetPanel
	title={t('Live streams')}
	summary={feed.isLoading ? undefined : t('{count} live', { count: feed.totalItems })}
>
	{#snippet trailing()}
		<Button href="/streaming" variant="link" size="sm" class="px-0">{t('View all')}</Button>
	{/snippet}
	<LiveStreamTiles items={feed.items} loading={feed.isLoading} compact />
</WidgetPanel>
