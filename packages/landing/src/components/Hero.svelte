<script lang="ts">
	import dashboardImg from '@assets/screens/dashboard.png';
	import Button from './Button.svelte';
	import { latestDownload } from '$lib/download.svelte';
	import { DISCORD_URL } from '$lib/urls';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimple';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogo';
</script>

<section class="relative overflow-hidden">
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.88_0.11_80_/_0.12),_transparent_55%)]"
	></div>
	<div
		class="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
	></div>

	<div class="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
		<div class="flex flex-col gap-6">
			<p class="text-primary text-sm font-semibold tracking-wide uppercase">Free desktop app</p>
			<h1 class="text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
				Your command center for Company of Heroes
			</h1>
			<p class="text-secondary-300 max-w-xl text-lg leading-relaxed">
				Replay analysis, match history, leaderboards, custom keybindings, and Twitch streaming
				tools — everything you need between games, without alt-tab chaos.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<Button href={latestDownload.url} download={latestDownload.fileName}>
					<DownloadSimpleIcon size={18} weight="duotone" class="mr-2" />
					Download free
				</Button>
				<Button href={DISCORD_URL} variant="secondary">
					<DiscordLogoIcon size={18} weight="duotone" class="mr-2" />
					Join Discord
				</Button>
			</div>
			<p class="text-secondary-500 text-sm">Windows · Free · Auto-updates with changelog</p>
		</div>

		<div class="relative mx-auto w-full max-w-xl lg:max-w-none">
			<div
				class="border-secondary-700/80 bg-secondary-900/60 shadow-xl overflow-hidden rounded-xl border"
			>
				<div class="border-secondary-800 bg-secondary-900 flex items-center gap-2 border-b px-4 py-3">
					<span class="size-2.5 rounded-full bg-red-500/80"></span>
					<span class="size-2.5 rounded-full bg-yellow-500/80"></span>
					<span class="size-2.5 rounded-full bg-green-500/80"></span>
					<span class="text-secondary-500 ml-2 text-xs">Company of Heroes - Companion</span>
				</div>
				<img
					src={dashboardImg}
					alt="Company of Heroes Companion dashboard"
					class="block w-full"
					width="1280"
					height="800"
					fetchpriority="high"
				/>
			</div>
		</div>
	</div>
</section>
