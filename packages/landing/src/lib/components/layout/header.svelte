<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import logo from '@assets/logo-transparent-bg.png';
	import { Button } from '@company-of-heroes/ui/button';
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import HeaderAuth from '$lib/components/layout/header-auth.svelte';
	import LocaleSwitcher from '$lib/components/layout/locale-switcher.svelte';
	import MobileNav from '$lib/components/layout/mobile-nav.svelte';
	import { cn } from '$lib/utils/cn';
	import { latestDownload } from '$lib/site/download.svelte';
	import { rememberedReplaysListHref } from '$lib/replays';
	import { href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { interactive, headerCellAction, headerCellActionPrimary } from '$lib/utils/variants';

	const { t } = useI18n();

	const navLinks = $derived([
		{ href: '/players', label: t('Players') },
		{ href: '/leaderboards', label: t('Leaderboards') },
		{ href: '/replays', label: t('Replays') },
		{ href: '/#donate', label: t('Donations') }
	]);

	let replaysListHref = $state('/replays');

	afterNavigate(() => {
		replaysListHref = rememberedReplaysListHref();
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

<header class="border-secondary-800 sticky top-0 z-50 flex h-16 items-stretch border-b bg-gray-950">
	<a href={href('/')} class={cn(interactive, 'flex min-w-0 items-stretch')}>
		<span
			class="border-secondary-800 relative h-full w-16 shrink-0 overflow-clip border-r bg-black"
		>
			<img
				src={logo}
				alt={t('Company of Heroes - Companion app')}
				class="absolute inset-0 size-full object-cover"
			/>
		</span>
		<div class="flex min-w-0 flex-col justify-center px-4">
			<p class="truncate font-medium text-white">{t('Company of Heroes')}</p>
			<p class="text-primary truncate text-xs font-medium">{t('Stats')}</p>
		</div>
	</a>

	<nav class="ms-auto hidden items-center gap-6 px-4 md:flex">
		{#each navLinks as link (link.href)}
			<a
				href={navHref(link.href)}
				class={cn(
					interactive,
					'text-sm font-medium transition-colors',
					isActive(link.href) ? 'text-primary' : 'hover:text-secondary-400 text-white'
				)}
			>
				{link.label}
			</a>
		{/each}
		<DiscordMenu class="hover:text-secondary-400 text-sm font-medium text-white transition-colors">
			Discord
		</DiscordMenu>
	</nav>

	<div class="border-secondary-800 ms-auto flex shrink-0 items-stretch border-l sm:ms-0">
		<div class="border-secondary-800 hidden h-full items-stretch border-r sm:flex">
			<LocaleSwitcher />
		</div>
		<div class="border-secondary-800 flex h-full items-stretch border-r">
			<HeaderAuth />
		</div>
		<Button
			href={latestDownload.url}
			download={latestDownload.fileName}
			variant="ghost"
			class={cn(headerCellActionPrimary, 'hidden sm:inline-flex')}
		>
			{t('Download for Windows')}
		</Button>
		<Button
			href={latestDownload.url}
			download={latestDownload.fileName}
			variant="ghost"
			class={cn(headerCellAction, 'sm:hidden')}
		>
			{t('Download')}
		</Button>
		<MobileNav />
	</div>
</header>
