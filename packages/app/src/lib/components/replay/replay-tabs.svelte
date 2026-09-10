<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { Snippet } from 'svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { cn } from '$lib/utils';
	import ReplayPlayers from './replay-players.svelte';
	import ReplayChat from './replay-chat.svelte';
	import ReplayActions from './replay-actions.svelte';
	import { useI18n } from '$lib/i18n';

	type Props = {
		flush?: boolean;
		match?: MatchExpanded | null;
		class?: string;
		overviewExtra?: Snippet;
		screenshots?: Snippet;
		showScreenshots?: boolean;
	};

	let {
		flush = false,
		match = null,
		class: className,
		overviewExtra,
		screenshots,
		showScreenshots = true
	}: Props = $props();
	const { t } = useI18n();
	let activeTab = $state('overview');
</script>

<div class={className}>
	<Tabs.Root bind:value={activeTab}>
		<Tabs.List
			class={cn(
				'border-secondary-800 px-4 py-2.5',
				flush ? 'border-b' : 'border-t border-b'
			)}
		>
			<Tabs.Trigger value="overview">{t('Overview')}</Tabs.Trigger>
			<Tabs.Trigger value="chat">{t('Chat')}</Tabs.Trigger>
			<Tabs.Trigger value="timeline">{t('Timeline')}</Tabs.Trigger>
			{#if showScreenshots}
				<Tabs.Trigger value="screenshots">{t('Screenshots')}</Tabs.Trigger>
			{/if}
		</Tabs.List>
		<Tabs.Content value="overview" class={flush ? undefined : 'flex grow flex-col gap-4'}>
			<ReplayPlayers {flush} {match} class={flush ? 'p-0' : undefined} />
			{@render overviewExtra?.()}
		</Tabs.Content>
		<Tabs.Content value="chat" class={flush ? undefined : 'flex grow flex-col gap-4'}>
			<ReplayChat {flush} class="grow" />
		</Tabs.Content>
		<Tabs.Content value="timeline" class={flush ? undefined : 'flex grow flex-col gap-4'}>
			<ReplayActions {flush} />
		</Tabs.Content>
		{#if showScreenshots}
			<Tabs.Content value="screenshots" class={flush ? undefined : 'flex grow flex-col gap-4'}>
				{@render screenshots?.()}
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</div>
