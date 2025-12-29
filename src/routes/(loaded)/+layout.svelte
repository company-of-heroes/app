<script lang="ts">
	import * as Nav from '$lib/components/ui/nav';
	import { watch } from 'runed';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { app } from '$core/context';
	import { ToastReplaysProgress } from '$lib/components/toasts';
	import { Avatar } from '$lib/components/ui/avatar';
	import { page } from '$app/state';
	import DashboardIcon from 'phosphor-svelte/lib/SquaresFour';
	import RankingIcon from 'phosphor-svelte/lib/Ranking';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogo';
	import Logo from '$lib/files/logo-transparent-bg.png?url';
	import SettingsIcon from 'phosphor-svelte/lib/GearSix';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogo';
	import TwitchLogoIcon from 'phosphor-svelte/lib/TwitchLogo';
	import GithubLogoIcon from 'phosphor-svelte/lib/GithubLogo';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';
	import HistoryIcon from 'phosphor-svelte/lib/LineSegments';
	import ReplaysIcons from 'phosphor-svelte/lib/ClockCounterClockwise';
	import CommandIcon from 'phosphor-svelte/lib/Command';
	import ChatIcon from 'phosphor-svelte/lib/ChatCentered';

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
				<Nav.Link href="/chat">
					<ChatIcon size={28} weight="duotone" />
					Chat
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
					<div class="mb-4 px-4">
						<a
							class="group hover:text-secondary-200 flex items-center gap-2 text-sm transition-colors"
							href="/account"
							data-active={page.url.pathname === '/account'}
						>
							<Avatar />
							<span>My account</span>
						</a>
					</div>
					<span class="flex items-center gap-2 px-4 py-4">
						<button
							class={cn(
								'bg-secondary-800 text-secondary-400 cursor-pointer rounded-md p-1.5',
								'hover:text-primary hover:bg-secondary-700 transition-colors'
							)}
							onclick={() => openUrl('https://discord.gg/Cc69hbDnPD')}
						>
							<DiscordLogoIcon weight="duotone" />
						</button>
						<button
							class={cn(
								'bg-secondary-800 text-secondary-400 cursor-pointer rounded-md p-1.5',
								'hover:text-primary hover:bg-secondary-700 transition-colors'
							)}
							onclick={() => openUrl('https://www.twitch.tv/fknoobscoh')}
						>
							<TwitchLogoIcon weight="duotone" />
						</button>
						<button
							class={cn(
								'bg-secondary-800 text-secondary-400 cursor-pointer rounded-md p-1.5',
								'hover:text-primary hover:bg-secondary-700 transition-colors'
							)}
							onclick={() => openUrl('https://github.com/fknoobs/app')}
						>
							<GithubLogoIcon weight="duotone" />
						</button>
						<span class="text-secondary-400 ms-auto flex items-center gap-2 text-sm">
							<span>v{app.features.updater.currentVersionFormatted}</span>
							{#if app.features.updater.hasUpdate}
								<ArrowRightIcon />
								<button
									class="text-primary cursor-pointer"
									onclick={() => app.features.updater.openDialog()}
								>
									v{app.features.updater.latestVersionFormatted}
								</button>
							{/if}
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
