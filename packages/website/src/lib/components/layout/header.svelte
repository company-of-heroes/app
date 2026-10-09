<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import logo128 from '@assets/logo/logo-128.webp';
	import logo256 from '@assets/logo/logo-256.webp';
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import HeaderAuth from '$lib/components/layout/header-auth.svelte';
	import LocaleSwitcher from '$lib/components/layout/locale-switcher.svelte';
	import MobileNav from '$lib/components/layout/mobile-nav.svelte';
	import { cn } from '$lib/utils/cn';
	import { Button } from '@company-of-heroes/ui/button';
	import { rememberedReplaysListHref, uploadReplayPath } from '$lib/replays';
	import { href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { interactive } from '$lib/utils/variants';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogoIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { tooltip } from '@company-of-heroes/ui/attachments';

	const { t } = useI18n();

	const navLinks = $derived([
		{ href: '/leaderboards', label: t('Leaderboards') },
		{ href: '/players', label: t('Players') },
		{ href: '/replays', label: t('Replays') },
		{ href: '/stats', label: t('Stats') },
		{ href: '/tournaments', label: t('Tournaments') },
		{ href: '/wiki', label: t('Wiki') }
	]);

	let replaysListHref = $state('/replays');
	const uploadHref = $derived(href(uploadReplayPath(!!page.data.user)));

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

		if (path === '/stats') {
			return current.startsWith('/stats');
		}

		if (path === '/replays') {
			return current.startsWith('/replays');
		}

		if (path === '/wiki') {
			return current.startsWith('/wiki');
		}

		if (path === '/tournaments') {
			return current.startsWith('/tournaments');
		}

		return false;
	}
</script>

<header class="border-secondary-800 sticky top-0 z-50 flex h-16 items-stretch border-b bg-gray-950">
	<a href={href('/')} class={cn(interactive, 'flex min-w-0 items-stretch')}>
		<span class="border-secondary-800 flex w-16 shrink-0 items-center border-r p-1">
			<img
				src={logo128}
				srcset="{logo128} 1x, {logo256} 2x"
				alt={t('Company of Heroes - Companion app')}
				class="size-full"
			/>
		</span>
		<div class="flex min-w-0 flex-col justify-center px-4">
			<p class="truncate font-medium text-white">{t('Global Community')}</p>
			<p class="text-primary truncate text-xs font-medium">{t('Website')}</p>
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
	</nav>

	<div class="border-secondary-800 ms-auto flex shrink-0 items-stretch border-l sm:ms-0">
		<div class="border-secondary-800 hidden h-full items-stretch border-r md:flex">
			<DiscordMenu
				label={t('Join Discord')}
				class="hover:bg-secondary-950/50 hover:text-secondary-400 inline-flex h-full items-center px-4 text-white transition-colors"
			>
				<DiscordLogoIcon class="size-5" weight="fill" />
			</DiscordMenu>
		</div>
		<div class="border-secondary-800 hidden h-full items-center border-r px-3 sm:flex">
			<Button
				href={uploadHref}
				variant="primary"
				size="sm"
				class="px-3"
				aria-label={t('Upload replay')}
				{@attach tooltip(t('Upload replay'))}
			>
				<UploadSimpleIcon class="size-4" />
				<span class="hidden lg:inline">{t('Upload replay')}</span>
			</Button>
		</div>
		<div class="border-secondary-800 hidden h-full items-stretch border-r sm:flex">
			<LocaleSwitcher />
		</div>
		<div class="border-secondary-800 flex h-full items-stretch border-r md:border-r-0">
			<HeaderAuth />
		</div>
		<MobileNav />
	</div>
</header>
