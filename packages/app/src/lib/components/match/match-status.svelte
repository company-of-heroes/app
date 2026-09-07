<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import { LiveBadge, PendingBadge } from '$lib/components/ui/badge';
	import { useI18n } from '$lib/i18n';
	import { createMatchLiveState } from './match-live-state.svelte';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { t } = useI18n();
	const state = createMatchLiveState();
</script>

<span {...restProps} class={cn('inline-flex items-center', restProps.class)}>
	{#if state.needsResult}
		{#if state.liveCheck === 'live'}
			<LiveBadge label={t('Live')} {@attach tooltip(t('Live'))} />
		{:else if state.liveCheck === 'unknown'}
			<PendingBadge
				label={t('Pending')}
				{@attach tooltip(t('Could not check if this match is still live.'))}
			/>
		{:else}
			<PendingBadge label={t('Pending')} {@attach tooltip(t('Result pending'))} />
		{/if}
	{:else}
		<ChecksIcon class="text-green-400" {@attach tooltip(t('Result saved'))} />
	{/if}
</span>
