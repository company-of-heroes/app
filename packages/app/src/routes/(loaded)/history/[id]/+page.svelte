<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import { page } from '$app/state';
	import { ReplayDetail, PageSkeleton as ReplayPageSkeleton } from '@company-of-heroes/ui/replay';
	import { isAlliesRace } from '@company-of-heroes/ui/replay/utils';
	import { HeadToHeadChip } from '@company-of-heroes/ui/head-to-head';
	import type { HeadToHead } from '@company-of-heroes/ui/head-to-head/types';
	import { resource, watch } from 'runed';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import { account } from '$core/account';
	import { loadCheaterSteamIds } from '$core/pocketbase/anti-cheat';
	import { getHeadToHead } from '$core/pocketbase/head-to-head';
	import * as Match from '$lib/components/match';
	import * as Player from '$lib/components/player';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';
	import { normalizeMapName } from '$lib/utils';

	const { t } = useI18n();
	const STATUS_POLL_MS = 10_000;
	const STATUS_POLL_MAX_MS = 60_000;
	/** A result that has not arrived by then comes in through `match.result` or a revisit. */
	const STATUS_POLL_STOP_MS = 15 * 60_000;

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

	/** The signed-in user's own slot, when they played this match. */
	const me = $derived.by(() => {
		const steamIds = account.user?.steamIds ?? [];
		return (detail?.players ?? []).find(
			(player) => !!player.steamId && steamIds.includes(player.steamId)
		);
	});
	// Your record against everyone outside your own team (every player when you did not play).
	const opponentIds = $derived.by(() => {
		if (!account.isAuthenticated) {
			return [] as number[];
		}

		const ids = (detail?.players ?? [])
			.filter((player) => player !== me)
			.filter((player) => !me || isAlliesRace(player.race) !== isAlliesRace(me.race))
			.map((player) => player.profile?.profile_id)
			.filter((id): id is number => id != null && id > 0);
		return [...new Set(ids)].sort((a, b) => a - b);
	});
	// A string key, so a refetch with the same players does not reload the records.
	const headToHeadKey = $derived(opponentIds.join(','));
	const headToHead = resource(
		() => headToHeadKey,
		async (key) => {
			if (!key) {
				return {} as Record<number, HeadToHead>;
			}

			try {
				return await getHeadToHead(key.split(',').map(Number), me?.profile.profile_id ?? null);
			} catch {
				return {} as Record<number, HeadToHead>;
			}
		}
	);

	// Pending results fill in on the server; keep the page current while it waits.
	watch(
		() => [page.params.id, !!detail?.needsResult] as const,
		([id, pending]) => {
			if (!id || !pending) {
				return;
			}

			const startedAt = Date.now();
			let delay = STATUS_POLL_MS;
			let timer: ReturnType<typeof setTimeout>;
			const poll = () => {
				timer = setTimeout(() => {
					void match.refetch();
					delay = Math.min(delay * 2, STATUS_POLL_MAX_MS);
					if (Date.now() - startedAt < STATUS_POLL_STOP_MS) {
						poll();
					}
				}, delay);
			};
			poll();
			return () => clearTimeout(timer);
		}
	);

	$effect(() => {
		return app.on('match.result', (updated) => {
			if (updated.id === page.params.id) {
				void match.refetch();
			}
		});
	});
</script>

<SetCrumbs items={[{ label: detail ? normalizeMapName(detail.map) : t('Match') }]} />

{#if detail}
	<div class="border-secondary-900 overflow-clip border-b">
		<ReplayDetail match={detail} showNav={false}>
			{#snippet nameExtra({ name, steamId, profileId })}
				{@const record = profileId != null ? headToHead.current?.[profileId] : undefined}
				{#if record}
					<HeadToHeadChip {record} alias={name} />
				{/if}
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
