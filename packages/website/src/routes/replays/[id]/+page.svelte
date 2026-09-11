<script lang="ts">
	import ReplayViewer from '$lib/components/replay/replay-viewer.svelte';
	import { PageSkeleton as ReplayPageSkeleton } from '@company-of-heroes/ui/replay';
	import { SITE_URL } from '$lib/site/urls';
	import { normalizeMapName } from '$lib/utils/player/format';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	function pageTitle(match: Awaited<PageData['match']>) {
		if (match.kind === 'member') {
			const title = match.title?.trim();
			if (title) {
				return title;
			}
		}

		return normalizeMapName(match.map);
	}
</script>

<svelte:head>
	{#await data.match}
		<title>{t('Loading replay')} | {t('Company of Heroes 1 Stats')}</title>
	{:then match}
		<title>{pageTitle(match)} | {t('Community replay')}</title>
		<meta
			name="description"
			content={t(
				'Watch a community Company of Heroes replay: overview, chat, timeline, and .rec download.'
			)}
		/>
		<meta property="og:url" content="{SITE_URL}{href(`/replays/${match.id}`)}" />
		<meta property="og:title" content="{pageTitle(match)} — {t('CoH replay')}" />
	{/await}
</svelte:head>

{#await data.match}
	<ReplayPageSkeleton
		overviewLabel={t('Overview')}
		chatLabel={t('Chat')}
		timelineLabel={t('Timeline')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		ratingLabel={t('Rating')}
		cpmLabel={t('CPM')}
	/>
{:then match}
	<ReplayViewer {match} />
{/await}
