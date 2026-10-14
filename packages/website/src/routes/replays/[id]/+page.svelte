<script lang="ts">
	import { PageSkeleton as ReplayPageSkeleton, ReplayDetail } from '@company-of-heroes/ui/replay';
	import ErrorState from '$lib/components/ui/error-state.svelte';
	import { SITE_URL } from '$lib/site/urls';
	import { normalizeMapName } from '$lib/utils/player/format';
	import {
		formatDurationSeconds,
		matchDurationSeconds,
		rememberedReplaysListHref,
		teamPlayers
	} from '$lib/replays';
	import { matchModeLabel } from '@company-of-heroes/ui/replay';
	import { resolveFallbackSrc, resolveMapSrc } from '$lib/utils/resolvers';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	type Match = Awaited<PageData['match']>;

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	function pageTitle(match: Match) {
		if (match.kind === 'member') {
			const title = match.title?.trim();
			if (title) {
				return title;
			}
		}

		return normalizeMapName(match.map);
	}

	function teamNames(match: Match, team: 'allies' | 'axis') {
		return teamPlayers(match, team)
			.map((player) => player.profile.alias)
			.filter(Boolean)
			.join(', ');
	}

	function metaDescription(match: Match) {
		const allies = teamNames(match, 'allies');
		const axis = teamNames(match, 'axis');
		return t(
			'{mode} on {map}, {duration}. {players}. Watch the overview and chat, or download the .rec replay ({downloads} downloads).',
			{
				mode: matchModeLabel(match),
				map: normalizeMapName(match.map),
				duration: formatDurationSeconds(matchDurationSeconds(match)),
				players: allies && axis ? `${allies} vs ${axis}` : allies || axis,
				downloads: match.downloadCount ?? 0
			}
		);
	}

	function metaImage(match: Match) {
		const src = resolveMapSrc(match.map);
		if (!src || src === resolveFallbackSrc()) {
			return `${SITE_URL}/og-image.png`;
		}

		return src.startsWith('http') ? src : `${SITE_URL}${src}`;
	}
</script>

{#snippet seo(match: Match)}
	<Seo
		title="{pageTitle(match)} | {t('Community replay')}"
		suffix={false}
		ogTitle="{pageTitle(match)} — {t('CoH replay')}"
		description={metaDescription(match)}
		type="video.other"
		image={metaImage(match)}
	/>
{/snippet}

{#if data.meta}
	{@render seo(data.meta)}
{:else}
	{#await data.match}
		<Seo title={t('Loading replay')} />
	{:then match}
		{@render seo(match)}
	{:catch}
		<Seo title={t('Could not load replay')} noindex />
	{/await}
{/if}

{#await data.match}
	<ReplayPageSkeleton />
{:then match}
	<ReplayDetail {match} />
{:catch error}
	<ErrorState
		title={error?.status === 404 ? t('Replay not found') : t('Could not load replay')}
		message={t(error?.message ?? 'Failed to load this replay. Please try again later.')}
		href={href(rememberedReplaysListHref())}
		linkLabel={t('Back to community replays')}
	/>
{/await}
