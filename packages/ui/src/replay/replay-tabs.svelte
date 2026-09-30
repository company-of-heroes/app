<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
	import * as Tabs from '@company-of-heroes/ui/tabs';

	type Props = {
		value?: string;
		showChat?: boolean;
		showTimeline?: boolean;
		showScreenshots?: boolean;
		overview?: Snippet;
		chat?: Snippet;
		timeline?: Snippet;
		screenshots?: Snippet;
	};

	const { t } = useI18n();

	let {
		value = $bindable('overview'),
		showChat = true,
		showTimeline = true,
		showScreenshots = false,
		overview,
		chat,
		timeline,
		screenshots
	}: Props = $props();
</script>

<Tabs.Root bind:value>
	<Tabs.List class="border-secondary-800 border-t border-b px-4 py-2.5">
		<Tabs.Trigger value="overview">{t('Overview')}</Tabs.Trigger>
		{#if showChat}
			<Tabs.Trigger value="chat">{t('Chat')}</Tabs.Trigger>
		{/if}
		{#if showTimeline}
			<Tabs.Trigger value="timeline">{t('Timeline')}</Tabs.Trigger>
		{/if}
		{#if showScreenshots}
			<Tabs.Trigger value="screenshots">{t('Screenshots')}</Tabs.Trigger>
		{/if}
	</Tabs.List>
	<Tabs.Content value="overview">
		{@render overview?.()}
	</Tabs.Content>
	{#if showChat}
		<Tabs.Content value="chat">
			{@render chat?.()}
		</Tabs.Content>
	{/if}
	{#if showTimeline}
		<Tabs.Content value="timeline">
			{@render timeline?.()}
		</Tabs.Content>
	{/if}
	{#if showScreenshots}
		<Tabs.Content value="screenshots">
			{@render screenshots?.()}
		</Tabs.Content>
	{/if}
</Tabs.Root>
