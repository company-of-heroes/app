<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource } from 'runed';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { cn } from '../cn';
	import Comments from '../comment/comments.svelte';
	import LikeButton from '../comment/like-button.svelte';
	import { formatDate } from '../format/date';
	import { normalizeMapName } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import * as List from '../ui/list';
	import { StaffDebug } from '../ui/staff-debug';
	import { detailMetaGrid, interactive } from '../variants';
	import MemberReplayDetailHeader from './member-replay-detail-header.svelte';
	import { loadReplayActionsAsync, parseReplayAsync } from './parse/parse-replay-async';
	import ReplayActions from './replay-actions.svelte';
	import ReplayChat from './replay-chat.svelte';
	import ReplayDetailHeader from './replay-detail-header.svelte';
	import ReplayOverview from './replay-overview.svelte';
	import ReplayTabs from './replay-tabs.svelte';
	import ReplayTabsSkeleton from './replay-tabs-skeleton.svelte';
	import type { CommunityMatchDetail, ReplayAction, ReplayData, ReplayMessage } from './types';
	import { formatReplayDurationLabel, isProGameplayMatch, matchDurationSeconds } from './utils';

	type ParsedReplay = ReplayData & {
		messages: ReplayMessage[];
		matchType?: string;
		mapFileName?: string;
		gameDate?: string;
	};

	type NameExtraArgs = { name: string; steamId: string | null; profileId: number | null };

	type Props = {
		match: CommunityMatchDetail;
		/** Host-only buttons next to the built-in actions (e.g. desktop edit / rename). */
		actions?: Snippet;
		/** Host-only screenshots tab. */
		screenshots?: Snippet;
		/** Extra marks after player names in the overview (e.g. cheater flags). */
		nameExtra?: Snippet<[NameExtraArgs]>;
		/** Back link + breadcrumb row; the desktop app renders its own breadcrumbs. */
		showNav?: boolean;
	};

	let { match, actions: hostActions, screenshots, nameExtra, showNav = true }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const user = $derived(host.auth.user);
	const isStaff = $derived(user?.isStaff ?? false);
	const isMember = $derived(match.kind === 'member');
	const isDeleted = $derived(match.visibility === 'deleted');
	const isMemberHeader = $derived(isMember || isDeleted);
	const commentTarget = $derived({ kind: isMember ? 'replay' : 'lobby', id: match.id } as const);
	const hasReplay = $derived(match.hasReplay ?? Boolean(match.replay));
	const isOwner = $derived(isMember && !!user?.id && match.uploadedBy?.id === user.id);
	const editHref = $derived(
		isOwner && !isDeleted && host.routes.editReplay ? host.routes.editReplay(match.id) : null
	);
	const publishHref = $derived(
		match.canPublish && !isMember ? host.routes.publishReplay(match.id) : null
	);
	const memberReplayHref = $derived(
		match.memberReplayId ? host.routes.memberReplay(match.memberReplayId) : null
	);
	const listHref = $derived(host.routes.replayList());
	const livePlayers = $derived(match.livePlayers ?? []);
	const sessionId = $derived(match.sessionId ?? 0);

	// --- replay file -------------------------------------------------------------
	let tab = $state('overview');
	let replay = $state.raw<ParsedReplay | null>(null);
	let parseId = $state<number | null>(null);
	let actionsLoaded = $state(false);
	let actionsPending = $state(false);
	let loading = $state(true);
	let errorMessage = $state('');
	const replayData = $derived(replay as ReplayData | null);

	$effect(() => {
		const current = match;
		if (!(current.hasReplay ?? Boolean(current.replay))) {
			loading = false;
			return;
		}

		let cancelled = false;
		loading = true;
		errorMessage = '';
		replay = null;
		void (async () => {
			try {
				const bytes = await host.api.replays.getFile(current);
				if (bytes.byteLength < 64) {
					throw new Error(t('Could not parse this replay.'));
				}

				const { parseId: nextParseId, replay: parsed } = await parseReplayAsync(bytes);
				const next = parsed as unknown as ParsedReplay;
				if (!next.players?.length) {
					throw new Error(t('Could not parse this replay.'));
				}

				if (!cancelled) {
					parseId = nextParseId;
					actionsLoaded = false;
					replay = next;
				}
			} catch (error) {
				if (!cancelled) {
					errorMessage = error instanceof Error ? error.message : t('Could not parse this replay.');
				}
			} finally {
				if (!cancelled) {
					loading = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (tab !== 'timeline' || !replay || parseId == null || actionsLoaded) {
			return;
		}

		const id = parseId;
		let cancelled = false;
		actionsPending = true;
		void loadReplayActionsAsync(id)
			.then((actions) => {
				if (!cancelled && replay) {
					replay = { ...replay, actions: actions as ReplayAction[] };
					actionsLoaded = true;
				}
			})
			.catch(() => {
				if (!cancelled) {
					actionsLoaded = true;
				}
			})
			.finally(() => {
				if (!cancelled) {
					actionsPending = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	// --- header facts -------------------------------------------------------------
	const parsedPlayers = $derived((replay?.players.length ?? 0) > 0);
	const mapName = $derived.by(() => {
		const title = isMember ? match.title?.trim() : '';
		if (title) {
			return title;
		}

		return replay?.mapFileName && parsedPlayers
			? normalizeMapName(replay.mapFileName.split(/[/\\]/).pop() ?? match.map)
			: normalizeMapName(match.map);
	});
	const isRanked = $derived(
		replay && parsedPlayers ? replay.matchType === 'automatch' : match.isRanked
	);
	const durationSeconds = $derived(
		replay?.duration && replay.duration > 0 ? replay.duration : matchDurationSeconds(match)
	);
	const duration = $derived(formatReplayDurationLabel(durationSeconds, { na: t('N/A') }));
	const submittedAt = $derived(
		formatDate(
			(replay?.gameDate && parsedPlayers ? replay.gameDate : '') || match.createdAt,
			host.locale(),
			'dateTime'
		)
	);
	const playerCount = $derived(
		(replay?.players.length ?? 0) || (match.livePlayers?.length ?? match.players.length)
	);
	const titleValue = $derived(
		isRanked ? (match.title ?? '') : match.result?.description || match.title || '—'
	);
	const gameMode = $derived(isRanked ? t('Ranked') : t('Custom match'));
	const statusPending = $derived(!!match.needsResult && !hasReplay);
	const isPro = $derived(isProGameplayMatch(match));
	const submittedBy = $derived(match.submittedBy ?? null);
	const submittedByHref = $derived(
		submittedBy
			? submittedBy.steamId
				? host.routes.player(submittedBy.steamId)
				: submittedBy.profileId
					? host.routes.player(submittedBy.profileId)
					: undefined
			: undefined
	);

	// --- downloads ------------------------------------------------------------------
	let downloadCount = $state(0);
	let downloading = $state(false);
	let downloaded = $state(false);
	$effect(() => {
		downloadCount = match.downloadCount ?? 0;
	});
	const downloadHref = $derived(hasReplay ? host.api.replays.downloadHref(match) : null);

	async function download() {
		if (downloading) {
			return;
		}

		downloading = true;
		try {
			const result = await host.api.replays.download(match);
			if (result?.downloadCount != null) {
				downloadCount = result.downloadCount;
			}

			downloaded = !downloadHref;
		} catch {
			// The host reports download failures itself.
		} finally {
			downloading = false;
		}
	}

	// --- staff: hide from public overviews -------------------------------------------
	const hiddenRecord = resource(
		() => (isStaff && sessionId > 0 ? sessionId : null),
		(id) => (id ? host.api.hiddenMatches.isHidden(id) : Promise.resolve(false))
	);
	let hidePending = $state(false);
	const isManuallyHidden = $derived(!!hiddenRecord.current);
	const isHidden = $derived(isManuallyHidden || !!match.hiddenByKeyword);

	async function toggleHidden() {
		if (!isStaff || sessionId <= 0 || hidePending) {
			return;
		}

		const hide = !isManuallyHidden;
		const confirmed = await host.notify.confirm(
			hide
				? t('Hide this match from public overviews?')
				: t('Show this match on public overviews again?'),
			{ confirm: hide ? t('Hide') : t('Show'), cancel: t('Cancel') }
		);
		if (!confirmed) {
			return;
		}

		hidePending = true;
		try {
			await host.api.hiddenMatches.setHidden(sessionId, hide);
			hiddenRecord.mutate(hide);
			host.notify.success(
				hide ? t('Match hidden from public overviews.') : t('Match is visible again.')
			);
		} catch {
			host.notify.error(hide ? t('Could not hide this match.') : t('Could not show this match.'));
		} finally {
			hidePending = false;
		}
	}
</script>

{#snippet titleMeta()}
	{#if isPro}
		<span class="text-primary shrink-0 text-xs font-bold tracking-wide uppercase">{t('Pro')}</span>
	{/if}
	{#if isStaff && isHidden}
		<Badge variant="warning">{t('Hidden')}</Badge>
	{/if}
	{#if !isMemberHeader && isStaff && isDeleted}
		<Badge variant="warning">{t('Deleted')}</Badge>
	{/if}
{/snippet}

{#snippet vote()}
	<LikeButton target={commentTarget} likeCount={match.likeCount} />
{/snippet}

{#snippet hideButton()}
	{#if isStaff && sessionId > 0}
		<Button
			type="button"
			variant="secondary"
			loading={hidePending}
			onclick={() => void toggleHidden()}
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
{/snippet}

{#snippet downloadButton()}
	{#if !downloadHref}
		<Button
			type="button"
			loading={downloading}
			disabled={!hasReplay}
			class={cn(downloaded && 'pointer-events-none opacity-50')}
			onclick={() => void download()}
		>
			{#if downloaded}
				<CheckIcon class="size-4" />
			{/if}
			{t('Download replay')}
		</Button>
	{/if}
{/snippet}

{#snippet staffDebug()}
	{#if isStaff}
		<StaffDebug>
			<div class={detailMetaGrid}>
				<List.Title>{t('Match ID')}</List.Title>
				<List.Value class="tabular-nums">{match.id}</List.Value>
				<List.Title>{t('Session ID')}</List.Title>
				<List.Value class="tabular-nums">{sessionId || '—'}</List.Value>
				<List.Title>{t('Updated')}</List.Title>
				<List.Value>{formatDate(match.updatedAt, host.locale(), 'dateTime')}</List.Value>
				<List.Title>{t('Owner')}</List.Title>
				<List.Value>{match.owner || '—'}</List.Value>
			</div>
		</StaffDebug>
	{/if}
{/snippet}

{#if isMemberHeader}
	<MemberReplayDetailHeader
		title={mapName}
		map={match.map}
		{listHref}
		{showNav}
		{isRanked}
		{statusPending}
		{titleValue}
		{submittedAt}
		{playerCount}
		uploadedBy={match.uploadedBy?.alias || '—'}
		{duration}
		{gameMode}
		showDownload={!!downloadHref}
		{downloadHref}
		downloadFileName={match.replay || `${match.id}.rec`}
		downloadDisabled={!hasReplay}
		{downloadCount}
		onDownloadClick={() => void download()}
		description={match.description}
		showDeletedBadge={isStaff && isDeleted}
		{vote}
		{titleMeta}
		afterDetails={staffDebug}
	>
		{#snippet actions()}
			{@render downloadButton()}
			{#if editHref}
				<Button type="button" variant="secondary" href={editHref}>{t('Edit')}</Button>
			{/if}
			{@render hostActions?.()}
			{@render hideButton()}
		{/snippet}
	</MemberReplayDetailHeader>
{:else}
	<ReplayDetailHeader
		{mapName}
		map={match.map}
		{downloadHref}
		downloadFileName={match.replay || `${match.id}.rec`}
		downloadDisabled={!hasReplay}
		{downloadCount}
		{listHref}
		{showNav}
		showDownload={!!downloadHref}
		onDownloadClick={() => void download()}
		{vote}
		{titleMeta}
		afterDetails={staffDebug}
	>
		{#snippet details()}
			<div class={detailMetaGrid}>
				<List.Title>{t('Status')}</List.Title>
				<List.Value class="flex items-center">
					{#if statusPending}
						<span title={t('Result pending')}><HourglassIcon class="text-primary" /></span>
					{:else}
						<span title={t('Result saved')}><ChecksIcon class="text-green-400" /></span>
					{/if}
				</List.Value>
				<List.Title>{t('Title')}</List.Title>
				<List.Value>
					{#if isRanked}
						<span class="flex items-center" title={t('Ranked match')}>
							<RankingIcon class="text-primary-100" weight="duotone" />
						</span>
					{:else}
						<span class="truncate">{titleValue}</span>
					{/if}
				</List.Value>
				<List.Title>{t('Submitted at')}</List.Title>
				<List.Value>{submittedAt}</List.Value>
				<List.Title>{t('Player count')}</List.Title>
				<List.Value>{playerCount}</List.Value>
				{#if submittedBy}
					{@const label = submittedBy.alias || submittedBy.steamId || submittedBy.profileId}
					{@const previewId =
						playerPreviewId({ steamId: submittedBy.steamId, profileId: submittedBy.profileId }) ??
						''}
					<List.Title>{t('Submitted by')}</List.Title>
					<List.Value class="inline-flex min-w-0 items-center gap-1.5">
						<PlayerStreamerIcon steamId={submittedBy.steamId} />
						{#if submittedByHref && previewId}
							<PlayerProfileLink
								href={submittedByHref}
								playerId={previewId}
								class={cn(interactive, 'hover:text-primary underline')}
							>
								{label}
							</PlayerProfileLink>
						{:else if submittedByHref}
							<a href={submittedByHref} class={cn(interactive, 'hover:text-primary underline')}>
								{label}
							</a>
						{:else}
							{submittedBy.alias || '—'}
						{/if}
					</List.Value>
				{/if}
				<List.Title>{t('Duration')}</List.Title>
				<List.Value>{duration}</List.Value>
				<List.Title>{t('Game mode')}</List.Title>
				<List.Value>{gameMode}</List.Value>
			</div>
		{/snippet}
		{#snippet actions()}
			{@render downloadButton()}
			{#if publishHref}
				<Button type="button" variant="secondary" href={publishHref}>
					<UploadSimpleIcon class="size-4" />
					{t('Publish replay')}
				</Button>
			{:else if memberReplayHref}
				<Button type="button" variant="secondary" href={memberReplayHref}>
					{t('View member replay')}
				</Button>
			{/if}
			{@render hostActions?.()}
			{@render hideButton()}
		{/snippet}
	</ReplayDetailHeader>
{/if}

{#snippet comments()}
	<Comments target={commentTarget} />
{/snippet}

{#if !hasReplay || (errorMessage && match.players.length > 0)}
	{#if errorMessage}
		<p class="text-secondary-400 px-4 py-3 text-sm">
			{errorMessage}
			{#if downloadHref}{t('You can still download the .rec file above.')}{/if}
		</p>
	{/if}
	<ReplayTabs
		bind:value={tab}
		showChat={false}
		showTimeline={false}
		showScreenshots={!!screenshots}
		{screenshots}
	>
		{#snippet overview()}
			<ReplayOverview {match} {livePlayers} {nameExtra} />
			{@render comments()}
		{/snippet}
	</ReplayTabs>
{:else if loading}
	<ReplayTabsSkeleton flush showTitle={false} />
{:else if errorMessage}
	<p class="text-secondary-400 px-4 py-3 text-sm">{errorMessage}</p>
	{@render comments()}
{:else if replay && replayData}
	{@const parsedReplay = replay}
	<ReplayTabs bind:value={tab} showScreenshots={!!screenshots} {screenshots}>
		{#snippet overview()}
			<ReplayOverview {match} replay={replayData} {livePlayers} {nameExtra} />
			{@render comments()}
		{/snippet}
		{#snippet chat()}
			<ReplayChat messages={parsedReplay.messages} playerCount={parsedReplay.playerCount} />
		{/snippet}
		{#snippet timeline()}
			{#if actionsPending}
				<p class="text-secondary-400 px-4 py-6 text-sm">{t('Loading…')}</p>
			{:else}
				<ReplayActions replay={replayData} />
			{/if}
		{/snippet}
	</ReplayTabs>
{/if}
