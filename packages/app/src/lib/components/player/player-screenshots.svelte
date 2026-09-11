<script lang="ts">
	import CaptureImage from '$lib/components/anti-cheat/capture-image.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { MatchListTable, type MatchListColumnId } from '$lib/components/match';
	import { interactive } from '$lib/components/ui/variants';
	import { watch } from 'runed';
	import { app } from '$core/app/context';
	import {
		listCaptureSessionHints,
		listCapturesBySessionIds,
		type CaptureRecord,
		type CaptureSessionHint
	} from '$core/pocketbase/anti-cheat';
	import dayjs from '$lib/dayjs';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';
	import type { MatchExpanded } from '$core/app/database/matches';

	type Props = {
		steamId: string;
		userId?: string;
		profileId?: number;
	};

	const SESSION_PAGE = 25;

	let { steamId, userId, profileId }: Props = $props();
	const { t } = useI18n();

	let matches = $state<MatchExpanded[]>([]);
	let capturesBySession = $state<Record<number, CaptureRecord[]>>({});
	let initialLoading = $state(true);
	let loadingMore = $state(false);
	let exhausted = $state(false);
	let capturePage = $state(1);
	let leftover = $state<CaptureSessionHint[]>([]);
	let seenSessionIds = $state<number[]>([]);

	const highlightedPlayers = $derived(
		profileId ? [String(profileId), steamId] : steamId ? [steamId] : []
	);
	const hasMore = $derived(matches.length > 0 && !exhausted);
	const columns: MatchListColumnId[] = [
		'map',
		'name',
		'type',
		'allies',
		'axis',
		'duration',
		'date',
		'actions',
		'expand'
	];

	function sessionStub(
		sessionId: number,
		map: string,
		capturedAt: string
	): MatchExpanded {
		return {
			id: `session:${sessionId}`,
			sessionId,
			map,
			title: '',
			players: [],
			createdAt: capturedAt,
			updatedAt: capturedAt,
			user: ''
		} as unknown as MatchExpanded;
	}

	function captureDate(capture: CaptureRecord) {
		return dayjs(capture.captured_at || capture.created).format('D MMM YYYY HH:mm');
	}

	function openCapture(capture: CaptureRecord) {
		app.modal.create({
			component: CaptureImage,
			title: t('Screenshot'),
			description: captureDate(capture),
			props: {
				capture,
				class: 'w-full max-h-[calc(100vh-9rem)] rounded-md object-contain p-4'
			},
			size: 'full'
		});
		app.modal.open();
	}

	function detailsHref(row: MatchExpanded) {
		if (!row.id || String(row.id).startsWith('session:')) return undefined;
		return `/history/${row.id}`;
	}

	async function collectSessionIds(limit: number): Promise<number[]> {
		const found: number[] = [];
		const seen = new Set(seenSessionIds);
		const queue = [...leftover];
		let noMorePages = exhausted;

		while (found.length < limit) {
			if (queue.length === 0) {
				if (noMorePages) break;
				const page = await listCaptureSessionHints(steamId, capturePage, { userId });
				if (page.items.length === 0) {
					noMorePages = true;
					break;
				}
				queue.push(...page.items);
				capturePage += 1;
				if (page.totalPages === 0 || capturePage > page.totalPages) {
					noMorePages = true;
				}
			}

			const hint = queue.shift();
			if (!hint) break;
			const sessionId = Number(hint.session_id);
			if (!Number.isInteger(sessionId) || sessionId <= 0 || seen.has(sessionId)) {
				continue;
			}
			seen.add(sessionId);
			found.push(sessionId);
		}

		leftover = queue;
		seenSessionIds = [...seen];
		exhausted = noMorePages && queue.length === 0;
		return found;
	}

	async function loadMatchesForSessions(sessionIds: number[]): Promise<MatchExpanded[]> {
		if (sessionIds.length === 0) return [];

		const [captures, idMap] = await Promise.all([
			listCapturesBySessionIds(steamId, sessionIds, { userId }),
			app.database.matches.getIdsBySessionIds(sessionIds)
		]);

		const grouped: Record<number, CaptureRecord[]> = { ...capturesBySession };
		for (const capture of captures) {
			const sessionId = Number(capture.session_id);
			if (!Number.isInteger(sessionId) || sessionId <= 0) continue;
			(grouped[sessionId] ??= []).push(capture);
		}
		capturesBySession = grouped;

		const lobbyIds = sessionIds.map((id) => idMap.get(id)).filter((id): id is string => !!id);
		const loaded = await app.database.matches.getByIds(lobbyIds);
		const bySession = new Map(
			loaded.map((match) => [Number(match.sessionId), match] as const)
		);

		return sessionIds.map((sessionId) => {
			const existing = bySession.get(sessionId);
			if (existing) return existing;
			const first = grouped[sessionId]?.[0];
			return sessionStub(
				sessionId,
				first?.map || '',
				first?.captured_at || first?.created || new Date().toISOString()
			);
		});
	}

	async function loadPage(reset: boolean) {
		if (!steamId && !userId) {
			matches = [];
			exhausted = true;
			return;
		}

		const sessionIds = await collectSessionIds(SESSION_PAGE);
		if (sessionIds.length === 0) {
			if (reset) matches = [];
			exhausted = true;
			return;
		}

		const rows = await loadMatchesForSessions(sessionIds);
		matches = reset ? rows : [...matches, ...rows];
	}

	watch(
		() => `${steamId}:${userId ?? ''}`,
		() => {
			matches = [];
			capturesBySession = {};
			leftover = [];
			seenSessionIds = [];
			capturePage = 1;
			exhausted = false;
			initialLoading = true;
			void (async () => {
				try {
					await loadPage(true);
				} catch (error) {
					console.warn('[ANTI-CHEAT]: screenshot matches failed:', error);
				} finally {
					initialLoading = false;
				}
			})();
		}
	);

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			await loadPage(false);
		} catch (error) {
			console.warn('[ANTI-CHEAT]: screenshot load more failed:', error);
		} finally {
			loadingMore = false;
		}
	}
</script>

<MatchListTable
	{matches}
	{columns}
	loading={initialLoading}
	{highlightedPlayers}
	emptyMessage={t('No screenshots for this player. Screenshots only appear when they used the app.')}
	class="bg-gray-950/90"
	{detailsHref}
>
	{#snippet expandContent({ match }: { row: import('@company-of-heroes/ui/match').MatchListRow; match: MatchExpanded })}
		{@const captures = capturesBySession[match.sessionId] ?? []}
		{#if captures.length === 0}
			<p class="text-secondary-400 px-4 py-3 text-sm">
				{t(
					'No screenshots for this match. Screenshots only appear when a player used the app.'
				)}
			</p>
		{:else}
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each captures as capture (capture.id)}
					<button
						type="button"
						class={cn(
							interactive,
							'relative aspect-square w-full overflow-clip opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100'
						)}
						onclick={() => openCapture(capture)}
					>
						<CaptureImage {capture} class="absolute inset-0 size-full object-cover" />
						{#if capture.hidden}
							<span class="absolute top-1.5 left-1.5 z-10">
								<Badge variant="warning">{t('Hidden')}</Badge>
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if hasMore}
			<div class="flex flex-col items-center gap-2 px-4 pt-2 pb-3">
				<p class="text-secondary-500 text-xs">
					{t('Showing {shown} matches', { shown: matches.length })}
				</p>
				<Button variant="secondary" size="sm" loading={loadingMore} onclick={() => loadMore()}>
					{t('Load more')}
				</Button>
			</div>
		{/if}
	{/snippet}
</MatchListTable>
