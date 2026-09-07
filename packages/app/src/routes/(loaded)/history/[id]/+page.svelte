<script lang="ts">
	import * as List from '$lib/components/ui/list';
	import * as Match from '$lib/components/match';
	import * as Replay from '$lib/components/replay';
	import { scale } from 'svelte/transition';
	import { page } from '$app/state';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { cn, normalizeMapName } from '$lib/utils';
	import { detailMetaGrid } from '$lib/components/ui/variants';
	import { resource, watch } from 'runed';
	import { bounceInOut } from 'svelte/easing';
	import dayjs from '$lib/dayjs';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { useI18n } from '$lib/i18n';
	import { StaffDebug } from '$lib/components/staff';
	import { tabTrigger } from '$lib/components/ui/variants';
	import { loadCheaterSteamIds } from '$core/pocketbase/anti-cheat';
	import {
		findHiddenMatch,
		hideMatch,
		listHiddenKeywordWords,
		relicLobbyDescription,
		titleMatchesHiddenKeyword,
		unhideMatch
	} from '$core/pocketbase/hidden-matches';
	import { getMatchModeLabel } from '$lib/components/widgets/dashboard-utils';

	const { t } = useI18n();
	const match = resource(
		() => page.params.id,
		() => app.database.matches.getById(page.params.id!)
	);

	const STATUS_POLL_MS = 10_000;
	const hasReplay = $derived(!!(match.current?.hasReplay || match.current?.replay));
	const pendingResult = $derived(!!match.current?.needsResult);

	const replayFile = resource(
		() => (hasReplay ? page.params.id : null),
		(id) => app.database.replays.getById(id!)
	);

	let isDownloading = $state(false);
	let didDownload = $derived(
		match.current && (await app.features.history.downloadExists(match.current))
	);

	const duration = $derived.by(() => {
		if (!match.current?.result?.startgametime || !match.current?.result?.completiontime) {
			return t('N/A');
		}
		const start = dayjs.unix(match.current.result.startgametime);
		const end = dayjs.unix(match.current.result.completiontime);
		const diff = dayjs.duration(end.diff(start));

		if (diff.hours() > 0) {
			return diff.format(t('H [hrs] m [mins] s [secs]'));
		}

		return diff.format(t('m [mins] s [secs]'));
	});

	const submittedBy = $derived(
		match.current?.result?.players.find((p) =>
			match.current?.user.steamIds?.includes(p.steamId || '')
		)
	);
	const downloadCount = $derived(match.current?.downloadCount ?? 0);
	const matchId = $derived(match.current?.id ?? page.params.id!);
	const highlightCommentId = $derived(page.url.searchParams.get('comment') || undefined);
	const sessionId = $derived(match.current?.sessionId ?? 0);
	const ownerId = $derived.by(() => {
		const user = match.current?.user;
		if (!user) {
			return '';
		}
		if (typeof user === 'string') {
			return user;
		}
		return String(user.id || '');
	});
	const isMatchOwner = $derived(!!ownerId && ownerId === app.account.userId);
	const memberReplayId = $derived.by(() => {
		const linked = match.current?.memberReplay;
		if (!linked) {
			return '';
		}
		if (typeof linked === 'string') {
			return linked;
		}
		return String((linked as { id?: string }).id || '');
	});
	const canPublishReplay = $derived(isMatchOwner && hasReplay && !memberReplayId);
	let matchTab = $state('overview');
	let hidePending = $state(false);
	const isStaff = $derived(app.account.isStaff);
	const hiddenRecord = resource(
		() => sessionId,
		() => (sessionId > 0 ? findHiddenMatch(sessionId) : Promise.resolve(null))
	);
	const hiddenWords = resource(
		() => isStaff,
		() =>
			isStaff
				? listHiddenKeywordWords().catch((error) => {
						console.warn('[HISTORY]: hidden title word lookup failed:', error);
						return [] as string[];
					})
				: Promise.resolve([] as string[])
	);
	const isManuallyHidden = $derived(!!hiddenRecord.current);
	const isHidden = $derived(
		isManuallyHidden ||
			titleMatchesHiddenKeyword(relicLobbyDescription(match.current), hiddenWords.current ?? [])
	);

	watch(
		() => highlightCommentId,
		(id) => {
			if (id) matchTab = 'overview';
		}
	);

	const cheaterSteamIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const player of match.current?.players ?? []) {
			if (player.steamId) ids.add(player.steamId);
		}
		for (const player of match.current?.result?.players ?? []) {
			if (player.steamId) ids.add(player.steamId);
			if (typeof player.name === 'string' && player.name.startsWith('/steam/')) {
				ids.add(player.name.slice('/steam/'.length));
			}
		}
		return [...ids];
	});
	const cheaters = resource(
		() => cheaterSteamIds.join(','),
		(key) => loadCheaterSteamIds(key ? key.split(',') : [])
	);

	function setLikeCount(count: number) {
		if (!match.current) return;
		match.mutate({ ...match.current, likeCount: count });
	}

	async function toggleHidden() {
		if (!sessionId) return;
		const currentlyHidden = isManuallyHidden;
		const confirmed = await confirm(
			currentlyHidden
				? t('Show this match on public overviews again?')
				: t('Hide this match from public overviews?'),
			{
				okLabel: currentlyHidden ? t('Show') : t('Hide'),
				cancelLabel: t('Cancel'),
				kind: 'warning'
			}
		);
		if (!confirmed) return;
		hidePending = true;
		try {
			if (currentlyHidden) {
				await unhideMatch(sessionId);
				hiddenRecord.mutate(null);
				app.toast.success(t('Match is visible again.'));
			} else {
				hiddenRecord.mutate(await hideMatch(sessionId, app.account.userId));
				app.toast.success(t('Match hidden from public overviews.'));
			}
		} catch (error) {
			console.error('[HISTORY]: hide toggle failed:', error);
			app.toast.error(
				currentlyHidden ? t('Could not show this match.') : t('Could not hide this match.')
			);
		} finally {
			hidePending = false;
		}
	}

	watch(
		() => [page.params.id, pendingResult] as const,
		([id, pending]) => {
			if (!id || !pending) return;

			const interval = setInterval(() => {
				void app.database.matches
					.getById(id)
					.then((updatedMatch) => match.mutate(updatedMatch))
					.catch((error) => {
						console.warn('[HISTORY]: match status poll failed:', error);
					});
			}, STATUS_POLL_MS);

			return () => clearInterval(interval);
		}
	);
</script>

<SetCrumbs items={[{ label: match.current ? normalizeMapName(match.current.map) : t('Match') }]} />

{#if match.current}
	<Match.Root match={match.current} class="border-secondary-900 overflow-clip border-b">
		<div
			class="border-secondary-800 grid grid-cols-1 gap-6 border-b sm:grid-cols-[minmax(220px,280px)_auto_minmax(0,1fr)]"
		>
			<div class="aspect-square self-start">
				<Match.MapImage flush alt={normalizeMapName(match.current.map)} />
			</div>
			<div class="flex items-start justify-center px-6 sm:px-0 sm:py-4">
				<Match.LikeButton
					lobbyId={matchId}
					likeCount={match.current.likeCount ?? 0}
					onCountChange={setLikeCount}
				/>
			</div>
			<div class="min-w-0">
				<div class="px-6 py-4 sm:pl-0">
					<div class="mb-3 flex min-w-0 items-center gap-3">
						<Match.MapName class="font-heading min-w-0 truncate text-3xl font-bold" />
						<Match.PendingBadge allowLive />
						<Match.ProBadge />
						{#if isStaff && isHidden}
							<Badge variant="warning">{t('Hidden')}</Badge>
						{/if}
					</div>

					<div class={detailMetaGrid}>
						<List.Title>{t('Status')}</List.Title>
						<List.Value class="flex items-center">
							<Match.Status />
						</List.Value>
						<List.Title>{t('Title')}</List.Title>
						<List.Value><Match.Title /></List.Value>

						<List.Title>{t('Submitted at')}</List.Title>
						<List.Value>{dayjs(match.current.createdAt).format('DD MMM YYYY, HH:mm')}</List.Value>
						<List.Title>{t('Player count')}</List.Title>
						<List.Value>{match.current.players?.length}</List.Value>

						{#if submittedBy}
							<List.Title>{t('Submitted by')}</List.Title>
							<List.Value>
								<a href={`/players/${submittedBy.profile_id}`} class="hover:text-primary underline">
									{submittedBy.alias}
								</a>
							</List.Value>
							<List.Title>{t('Duration')}</List.Title>
							<List.Value>{duration}</List.Value>

							<List.Title>{t('Game mode')}</List.Title>
							<List.Value>{getMatchModeLabel(match.current)}</List.Value>
						{:else}
							<List.Title>{t('Game mode')}</List.Title>
							<List.Value>{getMatchModeLabel(match.current)}</List.Value>
							<List.Title>{t('Duration')}</List.Title>
							<List.Value>{duration}</List.Value>
						{/if}
					</div>

					<div class="mt-4 flex flex-wrap items-center gap-3">
						{#if hasReplay}
							<Button
								onclick={() => {
									isDownloading = true;
									app.features.history
										.downloadReplay(match.current!)
										.then((result) => {
											if (result.ok) {
												didDownload = true;
												if (result.downloadCount != null && match.current) {
													match.mutate({
														...match.current,
														downloadCount: result.downloadCount
													});
												}
											} else {
												didDownload = false;
											}
										})
										.catch(() => {
											didDownload = false;
										})
										.finally(() => {
											isDownloading = false;
										});
								}}
								class={cn(didDownload && 'pointer-events-none cursor-not-allowed opacity-50')}
								loading={isDownloading}
							>
								{#if !isDownloading && !didDownload}
									<DownloadIcon class="mr-2" />
								{/if}
								{#if didDownload}
									<span in:scale={{ easing: bounceInOut, duration: 150 }}>
										<CheckIcon size={22} class="mr-2" />
									</span>
								{/if}
								{t('Download replay')}
							</Button>
						{:else}
							<Button disabled>
								<DownloadIcon class="mr-2" />
								{t('Download replay')}
							</Button>
						{/if}
						{#if canPublishReplay}
							<Button
								type="button"
								variant="secondary"
								href={`/replays/upload?fromMatch=${matchId}`}
							>
								<UploadSimpleIcon class="mr-2" />
								{t('Publish replay')}
							</Button>
						{:else if memberReplayId}
							<Button type="button" variant="secondary" href={`/replays/${memberReplayId}`}>
								{t('View member replay')}
							</Button>
						{/if}
						{#if isStaff && sessionId > 0}
							<Button
								type="button"
								variant="secondary"
								loading={hidePending}
								onclick={() => toggleHidden()}
							>
								{#if isManuallyHidden}
									<EyeIcon class="size-4" />
									{t('Show match')}
								{:else}
									<EyeSlashIcon class="size-4" />
									{t('Hide match')}
								{/if}
							</Button>
						{/if}
						<span
							class="text-secondary-400 inline-flex h-11 items-center gap-1.5 px-3 text-sm tabular-nums"
							title={t('Downloads')}
						>
							<DownloadIcon size={16} weight="duotone" />
							{downloadCount}
						</span>
					</div>
				</div>

				{#if isStaff}
					<StaffDebug>
						<div class={detailMetaGrid}>
							<List.Title>{t('Match ID')}</List.Title>
							<List.Value class="tabular-nums">{matchId}</List.Value>
							<List.Title>{t('Session ID')}</List.Title>
							<List.Value class="tabular-nums">{sessionId || '—'}</List.Value>
							<List.Title>{t('Updated')}</List.Title>
							<List.Value>
								{match.current.updatedAt
									? dayjs(match.current.updatedAt).format('DD MMM YYYY, HH:mm')
									: '—'}
							</List.Value>
							<List.Title>{t('Owner')}</List.Title>
							<List.Value>
								{match.current.user?.name ||
									match.current.user?.email ||
									match.current.user?.id ||
									'—'}
							</List.Value>
						</div>
					</StaffDebug>
				{/if}
			</div>
		</div>

		{#if !hasReplay}
			<div class="border-secondary-800 border-b">
				<div class="border-secondary-800 flex items-center gap-2 border-b px-4 py-2.5">
					<button
						type="button"
						class={tabTrigger}
						data-state={matchTab === 'overview' ? 'active' : undefined}
						onclick={() => (matchTab = 'overview')}
					>
						{t('Overview')}
					</button>
					<button
						type="button"
						class={tabTrigger}
						data-state={matchTab === 'screenshots' ? 'active' : undefined}
						onclick={() => (matchTab = 'screenshots')}
					>
						{t('Screenshots')}
					</button>
				</div>
				{#if matchTab === 'overview'}
					<Match.Overview match={match.current} cheaters={cheaters.current ?? new Set()} />
					<Match.Comments lobbyId={matchId} {highlightCommentId} />
				{:else}
					<Match.Screenshots
						{sessionId}
						lobbyId={matchId}
						players={match.current.players ?? []}
						resultPlayers={match.current.result?.players ?? []}
						cheaters={cheaters.current ?? new Set()}
					/>
				{/if}
			</div>
		{/if}

		{#if hasReplay}
			{#if replayFile.loading}
				<Replay.TabsSkeleton flush showTitle={false} />
			{:else if replayFile.current}
				<Replay.Root file={replayFile.current}>
					<Replay.Tabs flush match={match.current}>
						{#snippet overviewExtra()}
							<Match.Comments lobbyId={matchId} {highlightCommentId} />
						{/snippet}
						{#snippet screenshots()}
							<Match.Screenshots
								{sessionId}
								lobbyId={matchId}
								players={match.current?.players ?? []}
								resultPlayers={match.current?.result?.players ?? []}
								cheaters={cheaters.current ?? new Set()}
							/>
						{/snippet}
					</Replay.Tabs>
				</Replay.Root>
			{:else if replayFile.error}
				<p class="text-secondary-400 px-4 py-3 text-sm">
					{t('Failed to load replay data.')}
				</p>
				<Match.Comments lobbyId={matchId} {highlightCommentId} />
			{/if}
		{/if}
	</Match.Root>
{:else if match.error}
	<div class="border-secondary-800 border-b px-4 py-6">
		<h1 class="font-heading mb-1 text-xl font-bold">{t('Match not found')}</h1>
		<p class="text-secondary-400 text-sm">
			{t('This match is hidden or could not be found.')}
		</p>
	</div>
{/if}
