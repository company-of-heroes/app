<script lang="ts">
	import ErrorState from '$lib/components/ui/error-state.svelte';
	import { page } from '$app/state';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const title = $derived.by(() => {
		if (page.status === 404) {
			return t('Page not found');
		}

		if (page.status >= 500) {
			return t('Something went wrong');
		}

		return t('Could not load this page');
	});
	const message = $derived(
		t(
			page.error?.message ??
				(page.status >= 500
					? 'Something went wrong. Please try again later.'
					: 'This page is not available.')
		)
	);
</script>

<svelte:head>
	<title>{title} | {t('Company of Heroes 1 Stats')}</title>
</svelte:head>

<ErrorState {title} {message} href={href('/')} linkLabel={t('Back to home')} />
