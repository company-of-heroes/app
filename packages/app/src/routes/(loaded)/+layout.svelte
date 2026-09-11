<script lang="ts">
	import * as Nav from '$lib/components/ui/nav';
	import { watch } from 'runed';
	import { untrack } from 'svelte';
	import { Label } from '$lib/components/ui/label';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { app, createApp } from '$core/app/context';
	import {
		Breadcrumb,
		createBreadcrumbs,
		crumbsFromPath,
		useBreadcrumbs
	} from '$lib/components/ui/breadcrumb';
	import { ToastReplaysProgress } from '$lib/components/toasts';
	import { Avatar } from '$lib/components/ui/avatar';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { Modal } from '$lib/components/ui/modal';
	import { Toaster } from '$lib/components/ui/toasts';
	import { Button, ButtonBack } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import { Dialog } from '$lib/components/ui/dialog';
	import DashboardIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogoIcon';
	import Logo from '$lib/files/logo-transparent-bg.png?url';
	import pageBackgroundImage from '@assets/assets/art_ui_textures_textures_fe_bkg_cxp1.png';
	import SettingsIcon from 'phosphor-svelte/lib/GearSixIcon';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogoIcon';
	import TwitchLogoIcon from 'phosphor-svelte/lib/TwitchLogoIcon';
	import GithubLogoIcon from 'phosphor-svelte/lib/GithubLogoIcon';
	import ReplaysIcons from 'phosphor-svelte/lib/ClockCounterClockwiseIcon';
	import CommandIcon from 'phosphor-svelte/lib/CommandIcon';
	import BriefcaseIcon from 'phosphor-svelte/lib/BriefcaseIcon';
	import NotificationBell from '$lib/components/notifications/notification-bell.svelte';
	import HeaderSteamPlayers from '$lib/components/layout/header-steam-players.svelte';
	import * as User from '$lib/components/user';
	import { useI18n } from '$lib/i18n';

	import '$lib/fonts/TT Mussels/style.css';
	import '@fontsource/nunito-sans/800.css';

	import '../../app.css';

	let { children } = $props();
	const { t } = useI18n();

	watch(
		() => $state.snapshot(app.features['replay-analyzer'].progress),
		(progress, prevProgress) => {
			if (
				progress.isScanning &&
				progress.total > 0 &&
				(!prevProgress?.isScanning || prevProgress.total === 0)
			) {
				app.toast.custom(ToastReplaysProgress, {
					id: 'replay-analysis-progress',
					duration: Infinity
				});
			}

			if (!progress.isScanning && prevProgress?.isScanning) {
				app.toast.dismiss('replay-analysis-progress');
				if (progress.total > 0) {
					app.toast.success(t('Replay analysis complete!'));
				}
			}
		}
	);

	createApp(app);
	createBreadcrumbs();

	const breadcrumbs = useBreadcrumbs();
	const showBack = $derived(page.url.pathname !== '/');
	const backHref = $derived(
		crumbsFromPath(page.url.pathname, breadcrumbs.extra).find((crumb) => crumb.href)?.href ?? '/'
	);
	const BOOT_ROUTES = new Set(['/splashscreen', '/setup']);
	let hasClientHistory = $state(false);
	afterNavigate(({ from }) => {
		const fromPath = from?.url.pathname ?? '';
		hasClientHistory = Boolean(from) && !BOOT_ROUTES.has(fromPath);
	});
	let returning = $state(false);
	const impersonatedName = $derived(
		app.account.user?.name || app.account.user?.email || app.account.userId
	);

	const returnToAccount = async () => {
		returning = true;
		try {
			await app.account.stopImpersonating();
			app.toast.success(t('Returned to your account.'));
		} catch (error) {
			console.error('[ACCOUNT]: stopImpersonating failed:', error);
			app.toast.error(t('Could not restore your account'));
		} finally {
			returning = false;
		}
	};

	// Redirect on match start from any loaded route (not only the dashboard).
	// untrack on the catch-up read so we don't force-navigate when the user
	// leaves /current-game while a match is still active.
	$effect(() => {
		const redirectToCurrentGame = () => {
			if (page.url.pathname === '/current-game') {
				return;
			}

			void goto('/current-game');
		};

		untrack(() => {
			if (app.lobby?.started) {
				redirectToCurrentGame();
			}
		});

		return app.on('lobby.started', redirectToCurrentGame);
	});
</script>

<svelte:boundary>
	{#snippet pending()}{/snippet}
	<div class="flex h-screen w-screen overflow-hidden">
		<div
			class="border-secondary-800 bg-secondary-950 flex min-w-[300px] flex-col gap-8 border-r text-white"
		>
			<div class="mt-6 flex items-center gap-4 px-4">
				<img src={Logo} alt={t('Fknoobscoh - CoH app')} class="size-10" />
				<span class="font-medium">{t('Company of Heroes')}</span>
			</div>
			<Nav.Root class="grow">
				<Label class="text-secondary-300 px-4 font-semibold">{t('Menu')}</Label>
				<Nav.Link href="/">
					<DashboardIcon size={28} weight="duotone" />
					{t('Dashboard')}
				</Nav.Link>
				<Nav.Link href="/history" path="/replays">
					<ReplaysIcons size={28} weight="duotone" />
					{t('Replays')}
				</Nav.Link>
				<Nav.Link href="/shortcuts">
					<CommandIcon size={28} weight="duotone" />
					{t('Keybindings')}
				</Nav.Link>
				<Nav.Link href="/leaderboards">
					<RankingIcon size={28} weight="duotone" />
					{t('Leaderboards')}
				</Nav.Link>
				<Nav.Link href="/players">
					<UsersIcon size={28} weight="duotone" />
					{t('Players')}
				</Nav.Link>
				<Nav.Link href="/twitch">
					<TwitchIcon size={28} weight="duotone" />
					{t('Twitch')}
				</Nav.Link>
				<Nav.Link href="/settings">
					<SettingsIcon size={28} weight="duotone" />
					{t('Settings')}
				</Nav.Link>
				<div class="mt-auto">
					{#if app.account.isStaff}
						<Label class="text-secondary-400 px-4 text-xs font-semibold">{t('Management')}</Label>
						<Nav.Link href="/admin" class="gap-2 py-2 text-sm font-semibold">
							<BriefcaseIcon size={20} weight="duotone" />
							{t('Management')}
						</Nav.Link>
					{/if}
					<div class="mt-3 mb-4 flex items-center gap-2 px-4">
						<a
							class="group hover:text-secondary-200 flex min-w-0 grow items-center gap-2 text-sm transition-colors"
							href="/account"
							data-active={page.url.pathname === '/account'}
						>
							<Avatar />
							{#if app.account.user}
								<User.Root user={app.account.user}>
									<User.Name class="text-sm" />
								</User.Root>
							{:else}
								<span class="truncate">{t('My account')}</span>
							{/if}
						</a>
						{#if app.account.isAuthenticated}
							<NotificationBell />
						{/if}
					</div>
					<div class="flex flex-col gap-2 px-4 py-4">
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon-sm"
								class="bg-secondary-800 text-secondary-400 hover:text-primary hover:bg-secondary-700"
								onclick={() => openUrl('https://discord.gg/Cc69hbDnPD')}
							>
								<DiscordLogoIcon weight="duotone" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								class="bg-secondary-800 text-secondary-400 hover:text-primary hover:bg-secondary-700"
								onclick={() => openUrl('https://www.twitch.tv/fknoobscoh')}
							>
								<TwitchLogoIcon weight="duotone" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								class="bg-secondary-800 text-secondary-400 hover:text-primary hover:bg-secondary-700"
								onclick={() => openUrl('https://github.com/fknoobs/app')}
							>
								<GithubLogoIcon weight="duotone" />
							</Button>
						</div>
						<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
							<Button
								variant="link"
								size="sm"
								type="button"
								class="text-secondary-500 hover:text-secondary-300 px-0 font-normal"
								onclick={() => openUrl('https://coh1stats.com/privacy')}
							>
								{t('Privacy')}
							</Button>
							<Button
								variant="link"
								size="sm"
								class="text-secondary-500 hover:text-secondary-300 px-0 font-normal"
								onclick={() => app.features.updater.previewWhatsNew()}
							>
								{t("What's New")}
							</Button>
							<Button
								variant="link"
								size="sm"
								class="text-secondary-500 hover:text-secondary-300 px-0 font-normal"
								onclick={() => app.features.updater.openChangelog()}
							>
								v{app.features.updater.currentVersionFormatted}
							</Button>
						</div>
					</div>
				</div>
			</Nav.Root>
		</div>
		<div class="relative flex min-w-0 grow flex-col">
			<div aria-hidden="true" class="pointer-events-none absolute inset-0">
				<img
					src={pageBackgroundImage}
					alt=""
					class="size-full object-cover"
				/>
				<div class="absolute inset-0 bg-gray-950/95 mix-blend-color"></div>
				<div class="absolute inset-0 bg-gray-950/85"></div>
			</div>
			<main class="relative flex grow flex-col overflow-auto bg-gray-950/90 text-white">
				{#if app.account.isImpersonating}
					<Alert
						variant="warning"
						class="flex items-center justify-between gap-4 rounded-none border-x-0 border-t-0"
					>
						<span>{t('Signed in as {name}.', { name: impersonatedName })}</span>
						<Button
							variant="secondary"
							size="sm"
							loading={returning}
							onclick={() => returnToAccount()}
						>
							{t('Return to your account')}
						</Button>
					</Alert>
				{/if}
				<header class="border-secondary-800 flex items-center justify-between gap-3 border-b p-4">
					<div class="flex items-center gap-3">
						{#if showBack}
							<ButtonBack
								iconOnly
								href={backHref}
								useHistory={hasClientHistory}
								aria-label={t('Go back to previous page')}
								title={t('Go back')}
							/>
						{/if}
						<Breadcrumb />
					</div>
					<HeaderSteamPlayers />
				</header>
				{@render children()}
			</main>
		</div>
	</div>
</svelte:boundary>

<Dialog />
<Modal />
<Toaster />
