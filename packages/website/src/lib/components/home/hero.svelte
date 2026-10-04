<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import {
		latestDownload,
		loadReplayManagerDownload,
		replayManagerDownload
	} from '$lib/site/download.svelte';
	import { cn } from '$lib/utils/cn';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogoIcon';
	import { useI18n } from '$lib/i18n';
	import { onMount } from 'svelte';

	const { t } = useI18n();

	const downloads = $derived([
		{
			key: 'companion',
			title: t('Companion app'),
			description: t(
				'Runs next to the game: live lobby scouting, automatic match history, stream overlays and fair play. Needs an account.'
			),
			download: latestDownload,
			label: t('Download companion'),
			variant: 'primary' as const
		},
		{
			key: 'replay-manager',
			title: t('Replay Manager'),
			description: t(
				'Lightweight offline tool to browse, search, rename and delete the replays in your playback folder. No account, nothing uploaded.'
			),
			download: replayManagerDownload,
			label: t('Download Replay Manager'),
			variant: 'secondary' as const
		}
	]);

	onMount(() => {
		void loadReplayManagerDownload();
	});
</script>

<section class="border-secondary-800 border-b">
	<div class="flex min-w-0 flex-col justify-center px-6 py-8">
		<p class="text-primary mb-2 text-xs font-medium">{t('Company of Heroes - Companion app')}</p>
		<h1 class="font-heading text-3xl font-bold text-white sm:text-4xl">
			{t('Player stats, live lobbies, and community replays')}
		</h1>
		<p class="text-secondary-400 mt-3 max-w-2xl text-sm leading-relaxed">
			{t(
				'Look up Relic ranks, browse community match history, and see which companion users are in a game — plus a free desktop companion for scouting, overlays, and fair play.'
			)}
		</p>
		<div class="mt-5">
			<DiscordMenu
				class={cn(
					'inline-flex h-9 items-center justify-center gap-2 rounded-md border px-6 text-base transition-colors duration-150',
					'border-secondary-600 bg-secondary-800 hover:border-secondary-500 hover:bg-secondary-700 text-white'
				)}
			>
				<DiscordLogoIcon size={18} weight="duotone" />
				{t('Join Discord')}
			</DiscordMenu>
		</div>
	</div>
	<div
		class="border-secondary-800 divide-secondary-800 grid divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0"
	>
		{#each downloads as item (item.key)}
			<div class="flex flex-col gap-3 px-6 py-5">
				<div>
					<p class="font-medium text-white">{item.title}</p>
					<p class="text-secondary-400 mt-1 text-sm leading-relaxed">{item.description}</p>
				</div>
				<Button
					href={item.download.url}
					download={item.download.fileName}
					variant={item.variant}
					class="mt-auto self-start"
				>
					<DownloadSimpleIcon size={18} weight="duotone" />
					{item.label}
				</Button>
			</div>
		{/each}
	</div>
</section>
