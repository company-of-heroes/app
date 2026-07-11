<script lang="ts">
	import * as Nav from '$lib/components/ui/nav';
	import { watch } from 'runed';
	import { Label } from '$lib/components/ui/label';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { app, createApp } from '$core/app/context';
	import { ToastReplaysProgress } from '$lib/components/toasts';
	import { Avatar } from '$lib/components/ui/avatar';
	import { page } from '$app/state';
	import { Modal } from '$lib/components/ui/modal';
	import { Toaster } from '$lib/components/ui/toasts';
	import { Button } from '$lib/components/ui/button';
	import { Dialog } from '$lib/components/ui/dialog';
	import DashboardIcon from 'phosphor-svelte/lib/SquaresFour';
	import RankingIcon from 'phosphor-svelte/lib/Ranking';
	import UsersIcon from 'phosphor-svelte/lib/Users';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogo';
	import Logo from '$lib/files/logo-transparent-bg.png?url';
	import SettingsIcon from 'phosphor-svelte/lib/GearSix';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogo';
	import TwitchLogoIcon from 'phosphor-svelte/lib/TwitchLogo';
	import GithubLogoIcon from 'phosphor-svelte/lib/GithubLogo';
	import HistoryIcon from 'phosphor-svelte/lib/LineSegments';
	import ReplaysIcons from 'phosphor-svelte/lib/ClockCounterClockwise';
	import CommandIcon from 'phosphor-svelte/lib/Command';
	import BriefcaseIcon from 'phosphor-svelte/lib/Briefcase';
	import NotificationBell from '$lib/components/notifications/notification-bell.svelte';

	import '$lib/fonts/TT Mussels/style.css';
	import '@fontsource/nunito-sans/800.css';

	import '../../app.css';

	let { children } = $props();

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
					app.toast.success('Replay analysis complete!');
				}
			}
		}
	);

	createApp(app);
</script>

<svelte:boundary>
	{#snippet pending()}{/snippet}
	<div class="flex h-screen w-screen overflow-hidden">
		<div
			class="border-secondary-800 bg-secondary-950/90 flex min-w-[300px] flex-col gap-8 border-r text-white"
		>
			<div class="mt-6 flex items-center gap-4 px-4">
				<img src={Logo} alt="Fknoobscoh - CoH app" class="size-10" />
				<span class="font-medium">Company of Heroes</span>
			</div>
			<Nav.Root class="grow">
				<Label class="text-secondary-300 px-4 font-semibold">Menu</Label>
				<Nav.Link href="/">
					<DashboardIcon size={28} weight="duotone" />
					Dashboard
				</Nav.Link>
				<Nav.Link href="/replays">
					<ReplaysIcons size={28} weight="duotone" />
					Replays
				</Nav.Link>
				<Nav.Link href="/history">
					<HistoryIcon size={28} weight="duotone" />
					History
				</Nav.Link>
				<Nav.Link href="/shortcuts">
					<CommandIcon size={28} weight="duotone" />
					Keybindings
				</Nav.Link>
				<Nav.Link href="/leaderboards">
					<RankingIcon size={28} weight="duotone" />
					Leaderboards
				</Nav.Link>
				<Nav.Link href="/players">
					<UsersIcon size={28} weight="duotone" />
					Players
				</Nav.Link>
				<Nav.Link href="/twitch">
					<TwitchIcon size={28} weight="duotone" />
					Twitch
				</Nav.Link>
				<Nav.Link href="/settings">
					<SettingsIcon size={28} weight="duotone" />
					Settings
				</Nav.Link>
				<div class="mt-auto">
					{#if app.account.isStaff}
						<Label class="text-secondary-400 px-4 text-xs font-semibold">Management</Label>
						<Nav.Link href="/admin" class="gap-2 py-2 text-sm font-semibold">
							<BriefcaseIcon size={20} weight="duotone" />
							Management
						</Nav.Link>
					{/if}
					<div class="mt-3 mb-4 flex items-center gap-2 px-4">
						<a
							class="group hover:text-secondary-200 flex min-w-0 grow items-center gap-2 text-sm transition-colors"
							href="/account"
							data-active={page.url.pathname === '/account'}
						>
							<Avatar />
							<span class="truncate">{app.account.user?.name || 'My account'}</span>
						</a>
						{#if app.account.isAuthenticated}
							<NotificationBell />
						{/if}
					</div>
					<span class="flex items-center gap-2 px-4 py-4">
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
						<span class="text-secondary-400 ms-auto flex items-center gap-2 text-sm">
							<Button
								variant="link"
								size="sm"
								class="px-0"
								onclick={() => app.features.updater.openChangelog()}
							>
								v{app.features.updater.currentVersionFormatted}
							</Button>
						</span>
					</span>
				</div>
			</Nav.Root>
		</div>
		<main class="flex grow flex-col overflow-auto bg-gray-950/90 p-8 text-white">
			{@render children()}
		</main>
	</div>
</svelte:boundary>

<Dialog />
<Modal />

<Toaster />
