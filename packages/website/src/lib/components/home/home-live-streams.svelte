<script lang="ts">
	import { LiveStreamTiles, type LiveStream } from '@company-of-heroes/ui/twitch';
	import { useI18n } from '$lib/i18n';

	type Props = {
		streams: LiveStream[];
	};

	let { streams }: Props = $props();
	const { t } = useI18n();

	function streamHref(userName: string) {
		return `https://www.twitch.tv/${userName}`;
	}
</script>

<section class="border-secondary-800 border-b">
	<div
		class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
	>
		<div>
			<h2 class="font-heading text-xl font-bold text-white">{t('Live streams')}</h2>
			<p class="text-secondary-400 mt-1 text-sm">
				{t('Company of Heroes channels currently live on Twitch.')}
			</p>
		</div>
		<span class="text-secondary-400 text-sm">{t('{count} live', { count: streams.length })}</span>
	</div>
	<LiveStreamTiles
		items={streams}
		compact
		{streamHref}
		emptyMessage={t('No one is streaming Company of Heroes right now.')}
		liveLabel={t('Live')}
	/>
</section>
