<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
	import * as Tabs from '@company-of-heroes/ui/tabs';
	import { Badge } from '../ui/badge';

	type Props = {
		value?: string;
		showChat?: boolean;
		showScreenshots?: boolean;
		overview?: Snippet;
		chat?: Snippet;
		screenshots?: Snippet;
		/** Comments tab; hidden when left out. */
		comments?: Snippet;
		/** Shown next to the Comments tab label. */
		commentCount?: number;
	};

	const { t } = useI18n();

	let {
		value = $bindable('overview'),
		showChat = true,
		showScreenshots = false,
		overview,
		chat,
		screenshots,
		comments,
		commentCount = 0
	}: Props = $props();
</script>

<Tabs.Root bind:value>
	<Tabs.List class="border-secondary-800 w-full border-t border-b px-4">
		<Tabs.Trigger value="overview">{t('Overview')}</Tabs.Trigger>
		{#if showChat}
			<Tabs.Trigger value="chat">{t('Chat')}</Tabs.Trigger>
		{/if}
		{#if showScreenshots}
			<Tabs.Trigger value="screenshots">{t('Screenshots')}</Tabs.Trigger>
		{/if}
		{#if comments}
			<Tabs.Trigger value="comments">
				{t('Comments')}
				{#if commentCount > 0}
					<Badge variant="default" class="ml-1.5">{commentCount}</Badge>
				{/if}
			</Tabs.Trigger>
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
	{#if showScreenshots}
		<Tabs.Content value="screenshots">
			{@render screenshots?.()}
		</Tabs.Content>
	{/if}
	{#if comments}
		<Tabs.Content value="comments">
			{@render comments()}
		</Tabs.Content>
	{/if}
</Tabs.Root>
