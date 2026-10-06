<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import ArrowUpRightIcon from 'phosphor-svelte/lib/ArrowUpRightIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import { Button } from '../ui/button';
	import { Popover } from '../ui/popover';
	import TwitchLogo from './twitch-logo.svelte';
	import type { PlayerProfileLink } from './types';
	import YoutubeLogo from './youtube-logo.svelte';

	type Props = {
		links: PlayerProfileLink[];
		class?: string;
	};

	let { links, class: className }: Props = $props();

	const { t } = useI18n();

	const linkHost = (url?: string) => {
		try {
			return url ? new URL(url).hostname.replace(/^www\./, '') : '';
		} catch {
			return url ?? '';
		}
	};
</script>

<div class={cn('flex flex-wrap items-center gap-2', className)}>
	{#each links as link (link.url)}
		{@const isStreaming = link.type === 'twitch' || link.type === 'youtube'}
		<Popover side="bottom" align="start" contentClass="w-80 max-w-[calc(100vw-2rem)] p-3">
			{#snippet trigger({ props })}
				<Button
					{...props}
					variant={isStreaming ? 'secondary' : 'ghost'}
					size="sm"
					class={cn(
						'group gap-1.5 text-sm',
						isStreaming
							? 'bg-secondary-950/70 backdrop-blur-sm'
							: 'text-secondary-300 hover:bg-secondary-900/60 hover:text-primary data-[state=open]:text-primary px-2'
					)}
				>
					{#if link.type === 'twitch'}
						<TwitchLogo size={18} class="text-[#9146FF]" />
						<span>Twitch</span>
					{:else if link.type === 'youtube'}
						<YoutubeLogo size={18} />
						<span>YouTube</span>
					{:else}
						<LinkIcon size={16} class="text-primary" />
						<span class="max-w-48 truncate">{link.label || linkHost(link.url)}</span>
					{/if}
					<ArrowUpRightIcon
						size={14}
						class="text-secondary-500 group-hover:text-primary transition-colors"
					/>
				</Button>
			{/snippet}
			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<span class="text-secondary-400 text-xs">{t('External link')}</span>
					<span class="text-secondary-100 text-sm break-all">{link.url}</span>
				</div>
				<Button
					href={link.url}
					target="_blank"
					rel="noopener noreferrer"
					variant="primary"
					size="sm"
					class="justify-center"
				>
					<span>{t('Open link')}</span>
					<ArrowUpRightIcon size={14} />
				</Button>
			</div>
		</Popover>
	{/each}
</div>
