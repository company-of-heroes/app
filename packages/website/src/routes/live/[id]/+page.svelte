<script lang="ts">
	// `+page.server.ts` always redirects to `/replays/{lobbyId}` or 404s.
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<Seo title={t('Loading replay')} noindex />
