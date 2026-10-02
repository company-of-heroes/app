<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import ArrowUpRightIcon from 'phosphor-svelte/lib/ArrowUpRightIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import { Button } from '../ui/button';
	import TwitchLogo from './twitch-logo.svelte';
	import type { PlayerProfileLink } from './types';
	import YoutubeLogo from './youtube-logo.svelte';

	type Props = {
		links: PlayerProfileLink[];
		class?: string;
	};

	let { links, class: className }: Props = $props();

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
		{#if link.type === 'twitch' || link.type === 'youtube'}
			<Button
				href={link.url}
				target="_blank"
				rel="noopener noreferrer"
				variant="secondary"
				size="sm"
				class="group bg-secondary-950/70 gap-1.5 text-sm backdrop-blur-sm"
			>
				{#if link.type === 'twitch'}
					<TwitchLogo size={18} class="text-[#9146FF]" />
					<span>Twitch</span>
				{:else}
					<YoutubeLogo size={18} />
					<span>YouTube</span>
				{/if}
				<ArrowUpRightIcon
					size={14}
					class="text-secondary-500 group-hover:text-primary transition-colors"
				/>
			</Button>
		{:else}
			<Button
				href={link.url}
				target="_blank"
				rel="noopener noreferrer"
				variant="ghost"
				size="sm"
				class="group text-secondary-300 hover:bg-secondary-900/60 hover:text-primary gap-1.5 px-2 text-sm"
			>
				<LinkIcon size={16} class="text-primary" />
				<span class="max-w-48 truncate">{link.label || linkHost(link.url)}</span>
				<ArrowUpRightIcon
					size={14}
					class="text-secondary-500 group-hover:text-primary transition-colors"
				/>
			</Button>
		{/if}
	{/each}
</div>
