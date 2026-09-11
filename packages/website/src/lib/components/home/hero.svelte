<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import { latestDownload } from '$lib/site/download.svelte';
	import { cn } from '$lib/utils/cn';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import DiscordLogoIcon from 'phosphor-svelte/lib/DiscordLogoIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
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
		<div class="mt-5 flex flex-wrap items-center gap-3">
			<Button href={latestDownload.url} download={latestDownload.fileName} variant="primary">
				<DownloadSimpleIcon size={18} weight="duotone" />
				{t('Download app')}
			</Button>
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
</section>
