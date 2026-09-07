<script lang="ts">
	import { LiveBadge, PendingBadge } from '$lib/components/ui/badge';
	import { useI18n } from '$lib/i18n';
	import { createMatchLiveState } from './match-live-state.svelte';

	type Props = {
		/** When true, show Live if the match is still in an active lobby (history detail). Lists stay Pending. */
		allowLive?: boolean;
	};

	let { allowLive = false }: Props = $props();
	const { t } = useI18n();
	const state = createMatchLiveState();
</script>

{#if state.needsResult}
	{#if allowLive && state.isLive}
		<LiveBadge label={t('Live')} />
	{:else}
		<PendingBadge label={t('Pending')} />
	{/if}
{/if}
