<script lang="ts">
	import ErrorState from '$lib/components/ui/error-state.svelte';
	import { page } from '$app/state';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const title = $derived(page.status === 404 ? t('Player not found') : t('Could not load player'));
	const message = $derived(
		t(page.error?.message ?? 'Please try another Steam ID or Relic profile id.')
	);
</script>

<ErrorState {title} {message} href={href('/players')} linkLabel={t('Find a player')} />
