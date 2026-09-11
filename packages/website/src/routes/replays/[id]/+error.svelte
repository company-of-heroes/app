<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import ErrorState from '$lib/components/ui/error-state.svelte';
	import { page } from '$app/state';
	import { rememberedReplaysListHref } from '$lib/replays';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
	let listHref = $state(href('/replays'));

	afterNavigate(() => {
		listHref = href(rememberedReplaysListHref());
	});

	const title = $derived(page.status === 404 ? t('Replay not found') : t('Could not load replay'));
	const message = $derived(t(page.error?.message ?? 'This community replay is not available.'));
</script>

<ErrorState {title} {message} href={listHref} linkLabel={t('Back to community replays')} />
