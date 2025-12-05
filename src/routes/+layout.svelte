<script lang="ts">
	import * as Nav from '$lib/components/ui/nav';
	import { Toaster } from 'svelte-sonner';
	import { Dialog } from '$lib/components/ui/dialog';
	import SuccesIcon from 'phosphor-svelte/lib/Check';
	import ErrorIcon from 'phosphor-svelte/lib/ExclamationMark';
	import InfoIcon from 'phosphor-svelte/lib/QuestionMark';
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

	import '$lib/fonts/futura-pt-webfont/style.css';
	import '$lib/fonts/gotham/style.css';
	import '$lib/fonts/TT Firs Neue/style.css';
	import '$lib/fonts/TT Corals/style.css';
	import '$lib/fonts/TT Mussels/style.css';
	import '$lib/fonts/TT Barrels/style.css';
	import '$lib/fonts/League_Gothic/style.css';
	import '@fontsource/league-gothic';
	import '@fontsource/bebas-neue';
	import '@fontsource/nunito-sans/800.css';

	import '../app.css';
	import { Label } from '$lib/components/ui/label';
	import { Modal } from '$lib/components/ui/modal';
	import { cn } from '$lib/utils';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { app } from '$core/app';
	import { padEnd } from 'lodash-es';

	let { children } = $props();

	const updater = app.getPlugin('updater');
</script>

<svelte:boundary>
	{#snippet pending()}{/snippet}
	<div class="flex h-screen w-screen overflow-hidden">
		<div class="flex min-w-[300px] flex-col gap-8 bg-gray-900/90 text-white">
			<div class="mt-6 flex items-center gap-4 px-4">
				<img src={Logo} alt="Fknoobscoh - CoH app" class="size-10" />
				<span class="font-medium">Company of Heroes</span>
			</div>
			<Nav.Root class="grow">
				<Label class="px-4 font-semibold text-gray-300">Menu</Label>
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
				<Nav.Link href="/leaderboards">
					<RankingIcon size={28} weight="duotone" />
					Leaderboards
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
					<span class="flex items-center gap-2 px-4 py-4">
						<button
							class={cn(
								'cursor-pointer rounded-md bg-gray-800 p-1.5 text-gray-400',
								'hover:text-primary transition-colors hover:bg-gray-700'
							)}
							onclick={() => openUrl('https://discord.gg/Cc69hbDnPD')}
						>
							<DiscordLogoIcon weight="duotone" />
						</button>
						<button
							class={cn(
								'cursor-pointer rounded-md bg-gray-800 p-1.5 text-gray-400',
								'hover:text-primary transition-colors hover:bg-gray-700'
							)}
							onclick={() => openUrl('https://www.twitch.tv/fknoobscoh')}
						>
							<TwitchLogoIcon weight="duotone" />
						</button>
						<button
							class={cn(
								'cursor-pointer rounded-md bg-gray-800 p-1.5 text-gray-400',
								'hover:text-primary transition-colors hover:bg-gray-700'
							)}
							onclick={() => openUrl('https://github.com/fknoobs/app')}
						>
							<GithubLogoIcon weight="duotone" />
						</button>
						{#if updater}
							<span class="ms-auto flex items-center gap-2 text-sm text-gray-400">
								<span>v{updater.currentVersionFormatted}</span>
								{#if updater.hasUpdate}
									<ArrowRightIcon />
									<button class="text-primary cursor-pointer" onclick={() => updater.openDialog()}>
										v{updater.latestVersionFormatted}
									</button>
								{/if}
							</span>
						{/if}
					</span>
				</div>
			</Nav.Root>
		</div>
		<main class="grow overflow-auto bg-gray-800/90 p-8 text-white">
			{@render children()}
		</main>
	</div>
</svelte:boundary>

<Dialog />
<Modal />

<Toaster
	theme="dark"
	toastOptions={{
		unstyled: true,
		class: 'gap-4 flex bg-black border rounded-md px-4 py-2 shadow-xl',
		classes: {
			success: 'bg-green-950 border-green-500 text-white',
			error: 'bg-red-950 border-red-500 text-white',
			info: 'bg-blue-950 border-blue-500 text-white',
			icon: 'py-1'
		}
	}}
>
	{#snippet successIcon()}
		<SuccesIcon size={28} class="rounded bg-green-900/50 p-1.5" />
	{/snippet}
	{#snippet errorIcon()}
		<ErrorIcon size={28} class="rounded bg-red-900/50 p-1.5" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon size={28} class="rounded bg-blue-900/50 p-1" />
	{/snippet}
</Toaster>
