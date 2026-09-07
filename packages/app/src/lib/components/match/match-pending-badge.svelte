<script lang="ts">
	import { LiveBadge, PendingBadge } from '$lib/components/ui/badge';
	import { useI18n } from '$lib/i18n';
	import { tooltip } from '$lib/attachments';
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
	{#if allowLive && state.liveCheck === 'live'}
		<LiveBadge label={t('Live')} />
	{:else if state.liveCheck === 'unknown'}
		<PendingBadge
			label={t('Pending')}
			{@attach tooltip(t('Could not check if this match is still live.'))}
		/>
	{:else}
		<PendingBadge label={t('Pending')} />
	{/if}
{/if}
