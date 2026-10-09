<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle } from '@company-of-heroes/ui/variants';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { normalizeMapName } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { formatDurationSeconds } from '../replay/utils';
	import type { CommunityMatchDetail } from '../replay/types';
	import { Button } from '../ui/button';
	import MapImage from '../ui/map-image.svelte';
	import { roundLabel } from './format';
	import type {
		TournamentFormat,
		TournamentMatch,
		TournamentParticipant,
		TournamentReplay
	} from './types';
	import { useTournament } from './context';

	const context = useTournament();
	const format = $derived(context.tournament.format);
	const matches = $derived(context.matches);
	const participants = $derived(context.participants);
	const replays = $derived(context.replays);
	const { t } = useI18n();
	const host = useHost();

	const BRACKET_ORDER = { winners: 0, losers: 1, grand_final: 2, round_robin: 3 } as const;

	const aliases = $derived(new Map(participants.map((p) => [p.id, p.alias])));
	const byLobby = $derived(new Map(replays.map((replay) => [replay.lobbyId, replay])));
	const played = $derived(
		matches
			.filter((match) => match.games.length > 0)
			.sort(
				(a, b) =>
					BRACKET_ORDER[a.bracket] - BRACKET_ORDER[b.bracket] ||
					a.round - b.round ||
					a.position - b.position
			)
	);
	const rounds = $derived.by(() => {
		const most = new Map<string, number>();
		for (const match of matches) {
			most.set(match.bracket, Math.max(most.get(match.bracket) ?? 0, match.round));
		}

		return most;
	});

	const alias = (id: string | null) => (id ? (aliases.get(id) ?? t('Unknown')) : t('Unknown'));
	// The match page is the replay viewer; this is all the download endpoint needs.
	const replayOf = (lobbyId: string) =>
		({ id: lobbyId, kind: 'match', downloadCount: 0 }) as CommunityMatchDetail;
</script>

{#if played.length === 0}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('No games with a replay yet.')}
	</p>
{:else}
	{#each played as match (match.id)}
		<div class={cn(flushHeader, 'flex flex-wrap items-center justify-between gap-x-4 gap-y-1')}>
			<p class={flushHeaderTitle}>
				{roundLabel(t, format, match, rounds.get(match.bracket) ?? match.round)}
			</p>
			<p class="text-secondary-300 flex items-center gap-2 text-sm">
				<span class={cn(match.winner === match.playerA && 'font-semibold text-white')}>
					{alias(match.playerA)}
				</span>
				<span class="text-secondary-400 tabular-nums">{match.winsA} – {match.winsB}</span>
				<span class={cn(match.winner === match.playerB && 'font-semibold text-white')}>
					{alias(match.playerB)}
				</span>
			</p>
		</div>
		<ul>
			{#each match.games as game, index (game.lobbyId)}
				{@const replay = byLobby.get(game.lobbyId)}
				{@const winner = game.winner === 'A' ? match.playerA : match.playerB}
				<li
					class="border-secondary-800 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2"
				>
					{#if replay}
						<MapImage map={replay.map} class="size-10 shrink-0 rounded" />
					{/if}
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="text-sm font-semibold text-white">
							{t('Game {number}', { number: index + 1 })}
							{#if replay?.map}
								<span class="text-secondary-400 font-normal">
									{normalizeMapName(replay.map, false)}
								</span>
							{/if}
						</span>
						<span class="text-secondary-400 flex flex-wrap items-center gap-x-3 text-xs">
							<span class="flex items-center gap-1">
								<TrophyIcon size={12} weight="fill" class="text-warning" />
								{alias(winner)}
							</span>
							{#if replay?.durationSeconds}
								<span class="flex items-center gap-1 tabular-nums">
									<ClockIcon size={12} />
									{formatDurationSeconds(replay.durationSeconds)}
								</span>
							{/if}
						</span>
					</div>
					{#if replay}
						{@const detail = replayOf(replay.lobbyId)}
						{@const downloadHref = host.api.replays.downloadHref(detail)}
						<div class="flex shrink-0 items-center gap-2">
							<Button href={host.routes.match(replay.lobbyId)} size="sm" variant="secondary">
								<FilmReelIcon class="text-primary size-4" weight="duotone" />
								{t('Watch replay')}
							</Button>
							<Button
								href={downloadHref ?? undefined}
								download={downloadHref ? '' : undefined}
								onclick={() => void host.api.replays.download(detail).catch(() => {})}
								size="icon-sm"
								variant="secondary"
								{@attach tooltip(t('Download replay'))}
								aria-label={t('Download replay')}
							>
								<DownloadSimpleIcon class="size-4" />
							</Button>
						</div>
					{:else}
						<span class="text-secondary-500 shrink-0 text-xs">{t('No replay')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/each}
{/if}
