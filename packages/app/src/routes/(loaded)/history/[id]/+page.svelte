<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import { page } from '$app/state';
	import { ReplayDetail, PageSkeleton as ReplayPageSkeleton } from '@company-of-heroes/ui/replay';
	import { resource, watch } from 'runed';
	import { api, unwrapApi } from '$core/api';
	import { loadCheaterSteamIds } from '$core/pocketbase/anti-cheat';
	import * as Match from '$lib/components/match';
	import * as Player from '$lib/components/player';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';
	import { normalizeMapName } from '$lib/utils';

	const { t } = useI18n();
	const STATUS_POLL_MS = 10_000;

	const match = resource(
		() => page.params.id,
		(id) => unwrapApi(api.replays.getAny(id!))
	);

	const detail = $derived(match.current);
	const sessionId = $derived(detail?.sessionId ?? 0);
	const resultPlayers = $derived(detail?.result?.players ?? []);
	/** Screenshots match captures to roster slots by Steam id / alias. */
	const rosterPlayers = $derived(
		(detail?.players ?? []).map((player) => ({
			steamId: player.steamId ?? undefined,
			profile: player.profile
		})) as unknown as LobbyPlayer[]
	);

	const cheaterSteamIds = $derived(
		[
			...new Set(
				[...(detail?.players ?? []), ...resultPlayers]
					.map((player) => player.steamId)
					.filter((steamId): steamId is string => !!steamId)
			)
		].join(',')
	);
	const cheaters = resource(
		() => cheaterSteamIds,
		(key) => loadCheaterSteamIds(key ? key.split(',') : [])
	);

	// Pending results fill in on the server; keep the page current while it waits.
	watch(
		() => [page.params.id, !!detail?.needsResult && !detail?.hasReplay] as const,
		([id, pending]) => {
			if (!id || !pending) {
				return;
			}

			const interval = setInterval(() => void match.refetch(), STATUS_POLL_MS);
			return () => clearInterval(interval);
		}
	);
</script>

<SetCrumbs items={[{ label: detail ? normalizeMapName(detail.map) : t('Match') }]} />

{#if detail}
	<div class="border-secondary-900 overflow-clip border-b">
		<ReplayDetail match={detail} showNav={false}>
			{#snippet nameExtra({ steamId })}
				{#if steamId}
					<Player.Labels {steamId} class="shrink-0" />
					{#if cheaters.current?.has(steamId)}
						<Player.CheaterAlert compact />
					{/if}
				{/if}
			{/snippet}
			{#snippet screenshots()}
				<Match.Screenshots
					{sessionId}
					lobbyId={detail.id}
					players={rosterPlayers}
					{resultPlayers}
					cheaters={cheaters.current ?? new Set()}
				/>
			{/snippet}
		</ReplayDetail>
	</div>
{:else if match.error}
	<div class="border-secondary-800 border-b px-4 py-6">
		<h1 class="font-heading mb-1 text-xl font-bold">{t('Match not found')}</h1>
		<p class="text-secondary-400 text-sm">{t('This match is hidden or could not be found.')}</p>
	</div>
{:else}
	<ReplayPageSkeleton showNav={false} />
{/if}
