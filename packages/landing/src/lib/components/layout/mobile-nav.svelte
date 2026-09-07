<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import {
		flushHeader,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import LocaleSwitcher from '$lib/components/layout/locale-switcher.svelte';
	import { cn } from '$lib/utils/cn';
	import { latestDownload } from '$lib/site/download.svelte';
	import { rememberedReplaysListHref } from '$lib/replays';
	import { href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { interactive } from '$lib/utils/variants';
	import { Dialog } from 'bits-ui';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	const { t } = useI18n();

	let open = $state(false);
	let replaysListHref = $state('/replays');

	const navLinks = $derived([
		{ href: '/players', label: t('Players') },
		{ href: '/leaderboards', label: t('Leaderboards') },
		{ href: '/replays', label: t('Replays') },
		{ href: '/#donate', label: t('Donations') }
	]);

	afterNavigate(() => {
		replaysListHref = rememberedReplaysListHref();
		open = false;
	});

	function navHref(path: string) {
		if (path === '/replays' && unlocalizedPath(page.url.pathname).startsWith('/replays/')) {
			return href(replaysListHref);
		}

		return href(path);
	}

	function isActive(path: string) {
		const current = unlocalizedPath(page.url.pathname);
		if (path === '/players') {
			return current.startsWith('/players');
		}

		if (path === '/leaderboards') {
			return current.startsWith('/leaderboards');
		}

		if (path === '/replays') {
			return current.startsWith('/replays');
		}

		return false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class={cn(
			interactive,
			'border-secondary-800 text-white hover:bg-secondary-950/50 inline-flex h-full items-center justify-center border-l px-3 md:hidden'
		)}
		aria-label={t('Menu')}
	>
		<ListIcon size={22} weight="bold" />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class={cn(
				overlayBackdrop,
				'fixed inset-0 z-50',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
			)}
		/>
		<Dialog.Content
			class={cn(
				'data-[state=open]:animate-in data-[state=open]:slide-in-from-right fixed',
				'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
				'top-0 right-0 z-50 flex h-screen w-screen max-w-[calc(100%-2rem)] flex-col',
				'text-secondary-100 rounded-l-md outline-hidden sm:max-w-[420px]',
				surfaceModal
			)}
		>
			<div class={cn(flushHeader, 'flex items-center justify-between bg-gray-950')}>
				<Dialog.Title class={flushHeaderTitle}>{t('Menu')}</Dialog.Title>
				<Dialog.Close
					class={cn(
						interactive,
						'bg-secondary-800 hover:bg-secondary-700 rounded-md p-1 transition outline-none'
					)}
					aria-label={t('Close')}
				>
					<XIcon size={20} />
				</Dialog.Close>
			</div>
			<nav class="flex flex-1 flex-col overflow-y-auto">
				{#each navLinks as link (link.href)}
					<a
						href={navHref(link.href)}
						class={cn(
							interactive,
							'border-secondary-800 border-b px-4 py-3 text-sm font-medium transition-colors',
							isActive(link.href) ? 'text-primary' : 'hover:text-secondary-400 text-white'
						)}
						onclick={() => (open = false)}
					>
						{link.label}
					</a>
				{/each}
				<DiscordMenu
					class="border-secondary-800 hover:text-secondary-400 border-b px-4 py-3 text-sm font-medium text-white transition-colors"
				>
					Discord
				</DiscordMenu>
				<div class="border-secondary-800 flex items-center justify-between gap-3 border-b px-4 py-3">
					<span class="text-secondary-400 text-sm">{t('Language')}</span>
					<LocaleSwitcher
						side="bottom"
						align="end"
						class="hover:bg-secondary-800/40 h-auto rounded-md px-3 py-1.5"
					/>
				</div>
				<div class="mt-auto border-t border-secondary-800 p-4">
					<Button
						href={latestDownload.url}
						download={latestDownload.fileName}
						variant="primary"
						class="w-full"
						onclick={() => (open = false)}
					>
						{t('Download for Windows')}
					</Button>
				</div>
			</nav>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
