<script lang="ts">
	import { page } from '$app/state';
	import { PlayerProfile, PlayerProfileSkeleton } from '@company-of-heroes/ui/player';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton
	} from '@company-of-heroes/ui/replay';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Tabs from '@company-of-heroes/ui/tabs';
	import { meSteamIds } from '$lib/auth/user';
	import { uploadReplayPath } from '$lib/replays';
	import { getPlayerReplays } from '$lib/remote/replays.remote';
	import { SITE_URL } from '$lib/site/urls';
	import { href, useI18n } from '$lib/i18n';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	let currentTab = $state('stats');
	const mySteamIds = $derived(meSteamIds(page.data.user));
	const uploadHref = $derived(href(uploadReplayPath(!!page.data.user)));
</script>

<svelte:head>
	{#await data.player}
		<title>{t('Loading player')} | {t('Company of Heroes 1 Stats')}</title>
	{:then player}
		<title>{player.alias} | {t('Company of Heroes 1 Stats')}</title>
		<meta
			name="description"
			content={t(
				'Company of Heroes stats for {alias}: ranks, community performance, and recent matches.',
				{ alias: player.alias }
			)}
		/>
		<meta property="og:url" content="{SITE_URL}{href(`/players/${player.steamId}`)}" />
		<meta property="og:title" content="{player.alias} — {t('CoH player stats')}" />
	{/await}
</svelte:head>

{#await data.player}
	<PlayerProfileSkeleton />
{:then player}
	<PlayerProfile {player} bind:tab={currentTab}>
		{#snippet extraTabs()}
			<Tabs.Trigger value="replays">{t('Replays')}</Tabs.Trigger>
		{/snippet}
		{#snippet extraTabContent()}
			<Tabs.Content value="replays">
				{#if currentTab === 'replays'}
					{#await getPlayerReplays({ steamId: player.steamId, profileId: player.profileId })}
						<ReplayListSkeleton rowCount={5} />
					{:then replays}
						<ReplayList
							matches={replays}
							highlightedPlayers={[String(player.profileId), player.steamId]}
							meSteamIds={mySteamIds}
							sort="createdAt"
							sortDir="desc"
							onSort={() => {}}
							emptyMessage={t('No public replays with this player yet.')}
						/>
					{:catch}
						<p class="text-secondary-400 px-4 py-3 text-sm">
							{t('Could not load replays.')}
						</p>
					{/await}
					<div
						class="border-secondary-800 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
					>
						<p class="text-secondary-400 text-sm">
							{t('Played with {alias}? Share your replay so others can watch it.', {
								alias: player.alias
							})}
						</p>
						<Button href={uploadHref} variant="primary" size="sm">
							<UploadSimpleIcon class="size-4" />
							{t('Upload replay')}
						</Button>
					</div>
				{/if}
			</Tabs.Content>
		{/snippet}
	</PlayerProfile>
{/await}
