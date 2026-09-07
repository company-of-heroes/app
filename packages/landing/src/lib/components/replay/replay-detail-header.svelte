<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { resource } from 'runed';
	import { Badge } from '@company-of-heroes/ui/badge';
	import { Button } from '@company-of-heroes/ui/button';
	import * as List from '@company-of-heroes/ui/list';
	import { DetailHeader, MemberDetailHeader, formatReplayDurationLabel } from '@company-of-heroes/ui/replay';
	import { cn } from '@company-of-heroes/ui/cn';
	import { detailMetaGrid, interactive } from '@company-of-heroes/ui/variants';
	import {
		formatSubmittedAt,
		isProGameplayMatch,
		matchDurationSeconds,
		rememberReplaysListHref,
		rememberedReplaysListHref,
		type CommunityMatchDetail,
		type ParsedReplay
	} from '$lib/replays';
	import { normalizeMapName } from '$lib/utils/player/format';
	import { recordReplayDownload } from '$lib/remote/replays.remote';
	import { getHiddenMatch, hideMatch, unhideMatch } from '$lib/remote/hidden-matches.remote';
	import {
		hasCountedReplayDownload,
		markReplayDownload,
		replayDownloadVisitorId
	} from '$lib/replays/downloads';
	import { resolveMapSrc } from '$lib/utils/resolvers';
	import { currentLocale, href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { isStaffUser } from '$lib/auth/user';
	import StaffDebug from '$lib/components/staff/staff-debug.svelte';
	import ReplayLikeButton from './replay-like-button.svelte';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';

	type Props = {
		match: CommunityMatchDetail;
		replay: ParsedReplay | null;
	};

	let { match, replay }: Props = $props();
	const { t } = useI18n();
	const user = $derived(page.data.user);
	const isStaff = $derived(isStaffUser(user));
	const isOwner = $derived(
		match.kind === 'member' && !!user?.id && match.uploadedBy?.id === user.id
	);
	const isDeleted = $derived(match.visibility === 'deleted');
	const isMemberHeader = $derived(match.kind === 'member' || isDeleted);
	const editHref = $derived(isOwner && !isDeleted ? href(`/replays/${match.id}/edit`) : null);
	const canPublishReplay = $derived(!!match.canPublish && match.kind !== 'member');
	const memberReplayId = $derived(match.memberReplayId || '');
	const memberReplayHref = $derived(memberReplayId ? href(`/replays/${memberReplayId}`) : null);
	const publishHref = $derived(
		canPublishReplay ? href(`/replays/upload?fromMatch=${match.id}`) : null
	);
	let extraDownloads = $state(0);
	let counting = $state(false);
	let countedHere = $state(false);
	let listHref = $state(href('/replays'));
	let hidePending = $state(false);
	let hideError = $state('');
	const downloadCount = $derived((match.downloadCount ?? 0) + extraDownloads);
	const sessionId = $derived(match.sessionId ?? 0);
	const hiddenRecord = resource(
		() => `${isStaff}:${sessionId}`,
		() => (isStaff && sessionId > 0 ? getHiddenMatch(sessionId) : Promise.resolve(false))
	);
	const isManuallyHidden = $derived(!!hiddenRecord.current);
	const isHidden = $derived(isManuallyHidden || !!match.hiddenByKeyword);

	const mapName = $derived.by(() => {
		if (match.kind === 'member') {
			const title = match.title?.trim();
			if (title) {
				return title;
			}
		}

		return replay?.mapFileName && (replay.players?.length ?? 0) > 0
			? normalizeMapName(replay.mapFileName.split(/[/\\]/).pop() ?? match.map)
			: normalizeMapName(match.map);
	});
	const durationSeconds = $derived(
		replay?.duration && replay.duration > 0 ? replay.duration : matchDurationSeconds(match)
	);
	const duration = $derived(formatReplayDurationLabel(durationSeconds, { na: t('N/A') }));
	const isRanked = $derived(
		replay && (replay.players?.length ?? 0) > 0
			? replay.matchType === 'automatch'
			: match.isRanked
	);
	const isPro = $derived(isProGameplayMatch(match));
	const hasReplay = $derived(match.hasReplay ?? Boolean(match.replay));
	const downloadHref = $derived(hasReplay ? `/api/replay-file/${match.id}` : null);
	const downloadFileName = $derived(match.replay || `${match.id}.rec`);
	const submittedAt = $derived(
		formatSubmittedAt(
			(replay?.gameDate && (replay.players?.length ?? 0) > 0 ? replay.gameDate : '') ||
				match.createdAt,
			currentLocale()
		)
	);
	const playerCount = $derived.by(() => {
		const fromReplay = replay?.players.length ?? 0;
		if (fromReplay > 0) {
			return fromReplay;
		}

		return match.livePlayers?.length ?? match.players.length;
	});
	const submittedBy = $derived(match.submittedBy);
	const submittedByHref = $derived.by(() => {
		if (!submittedBy) {
			return undefined;
		}

		if (submittedBy.steamId) {
			return href(`/players/${submittedBy.steamId}`);
		}

		if (submittedBy.profileId) {
			return href(`/players/${submittedBy.profileId}`);
		}

		return undefined;
	});
	const titleValue = $derived(
		isRanked ? match.title : match.result?.description || match.title || '—'
	);
	const uploadedBy = $derived(match.uploadedBy?.alias || '—');
	const gameMode = $derived(isRanked ? t('Ranked') : t('Custom match'));
	const statusPending = $derived(!!match.needsResult && !hasReplay);

	function formatStaffDate(value?: string | null): string {
		if (!value) {
			return '—';
		}

		const date = new Date(value);
		if (!Number.isFinite(date.getTime())) {
			return '—';
		}

		return new Intl.DateTimeFormat(currentLocale(), {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	onMount(() => {
		countedHere = hasCountedReplayDownload(match.id);
	});

	afterNavigate(({ from }) => {
		if (unlocalizedPath(from?.url.pathname ?? '') === '/replays') {
			const next = `${from?.url.pathname}${from?.url.search}`;
			rememberReplaysListHref(next);
			listHref = href(next);
			return;
		}

		listHref = href(rememberedReplaysListHref());
	});

	async function recordDownload() {
		if (countedHere || counting) {
			return;
		}

		counting = true;
		extraDownloads += 1;
		try {
			const result = await recordReplayDownload({
				matchId: match.id,
				visitorId: replayDownloadVisitorId(),
				kind: match.kind === 'member' ? 'member' : 'match'
			});
			countedHere = true;
			markReplayDownload(match.id);
			if (!result.counted) {
				extraDownloads -= 1;
			}
		} catch {
			extraDownloads -= 1;
		} finally {
			counting = false;
		}
	}

	async function toggleHidden() {
		if (!isStaff || sessionId <= 0 || hidePending) {
			return;
		}

		const currentlyHidden = isManuallyHidden;
		const confirmed = window.confirm(
			currentlyHidden
				? t('Show this match on public overviews again?')
				: t('Hide this match from public overviews?')
		);
		if (!confirmed) {
			return;
		}

		hidePending = true;
		hideError = '';
		try {
			if (currentlyHidden) {
				await unhideMatch(sessionId);
				hiddenRecord.mutate(false);
			} else {
				await hideMatch(sessionId);
				hiddenRecord.mutate(true);
			}
		} catch {
			hideError = currentlyHidden
				? t('Could not show this match.')
				: t('Could not hide this match.');
		} finally {
			hidePending = false;
		}
	}
</script>

{#if isMemberHeader}
	<MemberDetailHeader
		title={mapName}
		map={match.map}
		{listHref}
		{resolveMapSrc}
		{isRanked}
		{statusPending}
		{titleValue}
		{submittedAt}
		{playerCount}
		{uploadedBy}
		{duration}
		{gameMode}
		{downloadHref}
		{downloadFileName}
		downloadDisabled={!hasReplay}
		{downloadCount}
		replaysLabel={t('Replays')}
		downloadLabel={t('Download replay')}
		backAriaLabel={t('Go back')}
		downloadsLabel={t('Downloads')}
		onDownloadClick={() => void recordDownload()}
		description={match.description}
		descriptionLabel={t('Description')}
		statusLabel={t('Status')}
		titleLabel={t('Title')}
		submittedAtLabel={t('Submitted at')}
		playerCountLabel={t('Player count')}
		uploadedByLabel={t('Uploaded by')}
		durationLabel={t('Duration')}
		gameModeLabel={t('Game mode')}
		resultSavedLabel={t('Result saved')}
		resultPendingLabel={t('Result pending')}
		rankedMatchLabel={t('Ranked match')}
		deletedLabel={t('Deleted')}
		showDeletedBadge={isStaff && isDeleted}
	>
		{#snippet vote()}
			<ReplayLikeButton replayId={match.id} likeCount={match.likeCount} />
		{/snippet}
		{#snippet titleMeta()}
			{#if isPro}
				<span class="text-primary shrink-0 text-xs font-bold tracking-wide uppercase">{t('Pro')}</span>
			{/if}
			{#if isStaff && isHidden}
				<Badge variant="warning">{t('Hidden')}</Badge>
			{/if}
		{/snippet}
		{#snippet actions()}
			{#if editHref}
				<Button type="button" variant="secondary" href={editHref}>
					{t('Edit')}
				</Button>
			{/if}
			{#if isStaff && sessionId > 0}
				<Button
					type="button"
					variant="secondary"
					loading={hidePending}
					title={hideError || undefined}
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
		{#snippet afterDetails()}
			{#if isStaff}
				<StaffDebug>
					<div class={detailMetaGrid}>
						<List.Title>{t('Match ID')}</List.Title>
						<List.Value class="tabular-nums">{match.id}</List.Value>
						<List.Title>{t('Session ID')}</List.Title>
						<List.Value class="tabular-nums">{sessionId || '—'}</List.Value>
						<List.Title>{t('Updated')}</List.Title>
						<List.Value>{formatStaffDate(match.updatedAt)}</List.Value>
						<List.Title>{t('Owner')}</List.Title>
						<List.Value>{match.owner || '—'}</List.Value>
					</div>
				</StaffDebug>
			{/if}
		{/snippet}
	</MemberDetailHeader>
{:else}
	<DetailHeader
		{mapName}
		map={match.map}
		{downloadHref}
		{downloadFileName}
		downloadDisabled={!hasReplay}
		{downloadCount}
		{listHref}
		{resolveMapSrc}
		replaysLabel={t('Replays')}
		downloadLabel={t('Download replay')}
		backAriaLabel={t('Go back')}
		downloadsLabel={t('Downloads')}
		onDownloadClick={() => void recordDownload()}
	>
		{#snippet vote()}
			<ReplayLikeButton lobbyId={match.id} likeCount={match.likeCount} />
		{/snippet}
		{#snippet titleMeta()}
			{#if isPro}
				<span class="text-primary shrink-0 text-xs font-bold tracking-wide uppercase">{t('Pro')}</span>
			{/if}
			{#if isStaff && isHidden}
				<Badge variant="warning">{t('Hidden')}</Badge>
			{/if}
			{#if isStaff && isDeleted}
				<Badge variant="warning">{t('Deleted')}</Badge>
			{/if}
		{/snippet}
		{#snippet details()}
			<div class={detailMetaGrid}>
				<List.Title>{t('Status')}</List.Title>
				<List.Value class="flex items-center">
					{#if match.needsResult && !hasReplay}
						<span title={t('Result pending')}>
							<HourglassIcon class="text-primary" />
						</span>
					{:else}
						<span title={t('Result saved')}>
							<ChecksIcon class="text-green-400" />
						</span>
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
					<List.Title>{t('Submitted by')}</List.Title>
					<List.Value>
						{#if submittedByHref}
							<a href={submittedByHref} class={cn(interactive, 'hover:text-primary underline')}>
								{submittedBy.alias || submittedBy.steamId || submittedBy.profileId}
							</a>
						{:else}
							{submittedBy.alias || '—'}
						{/if}
					</List.Value>
					<List.Title>{t('Duration')}</List.Title>
					<List.Value>{duration}</List.Value>

					<List.Title>{t('Game mode')}</List.Title>
					<List.Value>{gameMode}</List.Value>
				{:else}
					<List.Title>{t('Game mode')}</List.Title>
					<List.Value>{gameMode}</List.Value>
					<List.Title>{t('Duration')}</List.Title>
					<List.Value>{duration}</List.Value>
				{/if}
			</div>
		{/snippet}
		{#snippet actions()}
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
			{#if isStaff && sessionId > 0}
				<Button
					type="button"
					variant="secondary"
					loading={hidePending}
					title={hideError || undefined}
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
		{#snippet afterDetails()}
			{#if isStaff}
				<StaffDebug>
					<div class={detailMetaGrid}>
						<List.Title>{t('Match ID')}</List.Title>
						<List.Value class="tabular-nums">{match.id}</List.Value>
						<List.Title>{t('Session ID')}</List.Title>
						<List.Value class="tabular-nums">{sessionId || '—'}</List.Value>
						<List.Title>{t('Updated')}</List.Title>
						<List.Value>{formatStaffDate(match.updatedAt)}</List.Value>
						<List.Title>{t('Owner')}</List.Title>
						<List.Value>{match.owner || '—'}</List.Value>
					</div>
				</StaffDebug>
			{/if}
		{/snippet}
	</DetailHeader>
{/if}
