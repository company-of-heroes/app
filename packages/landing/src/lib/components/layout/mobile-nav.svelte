<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		flushHeader,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal,
		tabTrigger
	} from '@company-of-heroes/ui/variants';
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import { cn } from '$lib/utils/cn';
	import { rememberedReplaysListHref } from '$lib/replays';
	import {
		currentLocale,
		href,
		localeLabels,
		locales,
		localeSwitchHref,
		unlocalizedPath,
		useI18n,
		type AppLocale
	} from '$lib/i18n';
	import { interactive } from '$lib/utils/variants';
	import { Dialog } from 'bits-ui';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	const { t } = useI18n();

	let open = $state(false);
	let replaysListHref = $state('/replays');
	const locale = $derived(currentLocale());

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

	function selectLocale(next: AppLocale) {
		if (next === locale) {
			return;
		}

		window.location.assign(
			localeSwitchHref(`${page.url.pathname}${page.url.search}${page.url.hash}`, next)
		);
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
							'border-secondary-800 border-b px-4 py-3 text-left text-sm font-medium transition-colors',
							isActive(link.href) ? 'text-primary' : 'hover:text-secondary-400 text-white'
						)}
						onclick={() => (open = false)}
					>
						{link.label}
					</a>
				{/each}
				<DiscordMenu
					class="border-secondary-800 hover:text-secondary-400 w-full border-b px-4 py-3 text-left text-sm font-medium text-white transition-colors"
				>
					Discord
				</DiscordMenu>
				<div class="border-secondary-800 flex flex-col gap-2 border-b px-4 py-3">
					<span class="text-secondary-400 text-sm">{t('Language')}</span>
					<div class="flex flex-wrap gap-2">
						{#each locales as item (item)}
							<button
								type="button"
								class={cn(tabTrigger, 'inline-flex items-center gap-1.5')}
								data-state={item === locale ? 'active' : undefined}
								onclick={() => selectLocale(item)}
							>
								{#if item === locale}
									<CheckIcon size={14} weight="bold" class="text-primary shrink-0" />
								{/if}
								{localeLabels[item]}
							</button>
						{/each}
					</div>
				</div>
			</nav>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
