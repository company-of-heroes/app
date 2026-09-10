<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Dialog from '@company-of-heroes/ui/dialog';
	import { cn } from '$lib/utils/cn';
	import { COH_GLOBAL_DISCORD_URL, DISCORD_URL } from '$lib/site/urls';
	import { flushHeader, flushHeaderTitle, interactive } from '$lib/utils/variants';
	import { useI18n } from '$lib/i18n';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogoIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children }: Props = $props();
	const { t } = useI18n();
	let open = $state(false);

	const servers = $derived([
		{
			href: DISCORD_URL,
			name: 'Fknoobs CoH',
			hint: t('Companion Discord')
		},
		{
			href: COH_GLOBAL_DISCORD_URL,
			name: 'Company of Heroes Global Community',
			hint: t('The wider CoH community')
		}
	]);
</script>

<Dialog.Root bind:open>
	<button
		type="button"
		class={cn(interactive, className)}
		aria-haspopup="dialog"
		onclick={() => (open = true)}
	>
		{@render children()}
	</button>
	<Dialog.Portal>
		<Dialog.Overlay class="flex items-center justify-center overflow-y-auto p-4" />
		<Dialog.Content
			class={cn(
				'data-[state=open]:animate-in data-[state=open]:zoom-in absolute duration-75',
				'data-[state=closed]:animate-out data-[state=closed]:zoom-out data-[state=closed]:fade-out',
				'top-0 left-1/2 z-50 mx-auto mt-12 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2'
			)}
		>
			<div class={cn(flushHeader, 'flex items-center justify-between bg-gray-950')}>
				<Dialog.Title class={flushHeaderTitle}>{t('Join Discord')}</Dialog.Title>
				<Dialog.Close
					class={cn(interactive, 'text-secondary-400 hover:text-white p-1')}
					aria-label={t('Close')}
				>
					<XIcon size={16} weight="bold" />
				</Dialog.Close>
			</div>
			<div>
				{#each servers as server (server.href)}
					<a
						href={server.href}
						target="_blank"
						rel="noopener noreferrer"
						class={cn(
							interactive,
							'border-secondary-800 hover:bg-secondary-950/50 flex items-start gap-3 border-b px-4 py-3 last:border-b-0'
						)}
						onclick={() => (open = false)}
					>
						<DiscordLogoIcon class="text-primary mt-0.5 size-5 shrink-0" weight="duotone" />
						<span class="min-w-0">
							<span class="block font-medium text-white">{server.name}</span>
							<span class="text-secondary-400 text-sm">{server.hint}</span>
						</span>
					</a>
				{/each}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
