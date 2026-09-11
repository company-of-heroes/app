<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import {
		ListTable as MatchListTable,
		LIVE_MATCH_LIST_COLUMNS
	} from '@company-of-heroes/ui/match';
	import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
	import type { LiveLobbyRecord } from '@company-of-heroes/api';
	import { Button } from '@company-of-heroes/ui/button';
	import { meSteamIds } from '$lib/auth/user';
	import { currentLocale, useI18n } from '$lib/i18n';
	import { API_URL } from '$lib/site/urls';
	import {
		liveLobbyPlayerHref,
		liveLobbyPlayerLabel,
		matchListDetailsHref,
		toLiveLobby,
		toMatchListRow
	} from '$lib/utils/live-lobby';
	import { formatRelativeIso, normalizeMapName } from '$lib/utils/player/format';
	import {
		resolveFactionFlag,
		resolveFallbackSrc,
		resolveMapSrc,
		getRankImageByRace
	} from '$lib/utils/resolvers';

	type Props = {
		lobbies: LiveLobbyRecord[];
		loading?: boolean;
		error?: string | null;
	};

	let { lobbies, loading = false, error = null }: Props = $props();
	const { t } = useI18n();
	const mySteamIds = $derived(meSteamIds(page.data.user));
	const isDev = import.meta.env.DEV;
	let seeding = $state(false);
	let seedError = $state<string | null>(null);

	const rows = $derived(lobbies.map((lobby) => toMatchListRow(toLiveLobby(lobby, t))));
	const loadError = $derived(error || seedError);

	function playerLabel(player: LiveLobbyPlayer) {
		return liveLobbyPlayerLabel(player, t);
	}

	async function seedTestLobbies() {
		seeding = true;
		seedError = null;
		try {
			const response = await fetch(`${API_URL}/api/dev/live-lobbies/seed`, { method: 'POST' });
			if (!response.ok) {
				throw new Error((await response.text()) || response.statusText);
			}

			await invalidateAll();
		} catch (error) {
			seedError = error instanceof Error ? error.message : String(error);
		} finally {
			seeding = false;
		}
	}

	async function clearTestLobbies() {
		seeding = true;
		seedError = null;
		try {
			const response = await fetch(`${API_URL}/api/dev/live-lobbies/seed`, { method: 'DELETE' });
			if (!response.ok) {
				throw new Error((await response.text()) || response.statusText);
			}

			await invalidateAll();
		} catch (error) {
			seedError = error instanceof Error ? error.message : String(error);
		} finally {
			seeding = false;
		}
	}
</script>

<section class="border-secondary-800 border-b">
	<div
		class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
	>
		<div>
			<h2 class="font-heading text-xl font-bold text-white">{t('Live lobbies')}</h2>
			<p class="text-secondary-400 mt-1 text-sm">
				{t('Matches that companion users are in right now.')}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			{#if isDev}
				<div class="flex items-center gap-2">
					<Button size="sm" variant="secondary" disabled={seeding} onclick={seedTestLobbies}>
						{t('Seed test')}
					</Button>
					<Button size="sm" variant="ghost" disabled={seeding} onclick={clearTestLobbies}>
						{t('Clear test')}
					</Button>
				</div>
			{/if}
			{#if !loading}
				<span class="text-secondary-400 text-sm">{t('{count} active', { count: rows.length })}</span>
			{/if}
		</div>
	</div>
	{#if loadError}
		<p class="border-secondary-800 text-red-400 border-b px-4 py-2 text-sm">
			{seedError ?? t('Could not load live lobbies.')}
		</p>
	{/if}
	<MatchListTable
		{rows}
		{loading}
		columns={LIVE_MATCH_LIST_COLUMNS}
		meSteamIds={mySteamIds}
		{resolveMapSrc}
		{resolveFallbackSrc}
		{resolveFactionFlag}
		getRankImage={getRankImageByRace}
		playerHref={liveLobbyPlayerHref}
		{playerLabel}
		detailsHref={matchListDetailsHref}
		formatMapName={normalizeMapName}
		formatStarted={(createdAt) => formatRelativeIso(createdAt, currentLocale())}
		emptyMessage={loadError
			? t('Could not load live lobbies.')
			: t('No community members are in a match right now.')}
		mapLabel={t('Map')}
		nameLabel={t('Name')}
		typeLabel={t('Type')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		hostLabel={t('Host')}
		startedLabel={t('Started at')}
		unknownHostLabel={t('Unknown')}
		detailsLabel={t('Details')}
		eloLabel={t('ELO')}
		levelLabel={t('Level')}
		posLabel={t('Pos')}
		winsLabel={t('W')}
		lossesLabel={t('L')}
		streakLabel={t('Streak')}
	/>
</section>
