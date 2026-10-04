<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import { PageSkeleton as ReplayPageSkeleton } from '@company-of-heroes/ui/replay';
	import LocalReplayDetail from '$lib/components/local-replay-detail.svelte';
	import { useI18n } from '$lib/i18n';
	import { useReplayLibrary } from '$lib/library/replay-library.svelte';

	const { t } = useI18n();
	const library = useReplayLibrary();

	const path = $derived(page.url.searchParams.get('file') ?? '');
	const entry = $derived(library.find(path));
	const loading = $derived(!library.ready || (library.scanning && library.entries.length === 0));
</script>

{#if entry}
	{#key entry.path}
		<LocalReplayDetail {entry} />
	{/key}
{:else if loading}
	<ReplayPageSkeleton />
{:else}
	<div class="flex flex-col items-start gap-3 px-4 py-6">
		<p class="text-secondary-400 text-sm">
			{t('This replay is no longer in your playback folder.')}
		</p>
		<Button href="/" variant="secondary">{t('Back to replays')}</Button>
	</div>
{/if}
