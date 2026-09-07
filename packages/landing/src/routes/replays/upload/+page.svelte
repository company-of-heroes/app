<script lang="ts">
	import { resource } from 'runed';
	import { tick } from 'svelte';
	import { Button } from '@company-of-heroes/ui/button';
	import { CommentComposer } from '@company-of-heroes/ui/comment';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import * as List from '@company-of-heroes/ui/list';
	import {
		Actions,
		Chat,
		DetailHeader,
		FileDropzone,
		Overview,
		PlayerSteamLinks,
		Tabs,
		formatDurationSeconds,
		type ReplaySteamLinkPlayer
	} from '@company-of-heroes/ui/replay';
	import type { ReplayAction, ReplayData, ReplayPlayer } from '@company-of-heroes/ui/replay';
	import { cn } from '@company-of-heroes/ui/cn';
	import { detailMetaGrid, interactive } from '@company-of-heroes/ui/variants';
	import { isValidSteamId } from '@company-of-heroes/api';
	import {
		countedActions,
		doctrineBannerUrl,
		formatSubmittedAt,
		playerCpm,
		raceFromReplayFaction,
		type CommunityMatchDetail,
		type CommunityPlayer,
		type ParsedReplay,
		type ParsedReplayPlayer
	} from '$lib/replays';
	import { parseReplayAsync, loadReplayActionsAsync } from '$lib/replays/parse-replay-async';
	import {
		flagImageUrl,
		getCountryDisplayName,
		getRankImageByRace,
		resolveAvatarUrl,
		resolveFactionFlag,
		resolveMapSrc,
		resolvePlayerHref
	} from '$lib/utils/resolvers';
	import { normalizeMapName } from '$lib/utils/player/format';
	import { currentLocale, href, useI18n } from '$lib/i18n';
	import {
		previewMemberReplayRatings,
		publishMatchAsMemberReplay,
		searchPlayersForUpload,
		uploadMemberReplay
	} from '$lib/remote/replays.remote';
	import { searchMentionUsers } from '$lib/remote/match-social.remote';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import type { PageData } from './$types';

	type UploadPageData = PageData & {
		fromMatch: CommunityMatchDetail | null;
	};

	let { data }: { data: UploadPageData } = $props();
	const { t } = useI18n();
	const composerLabels = $derived({
		searchingLabel: t('Searching...'),
		noUsersLabel: t('No users found.'),
		mentionHintLabel: t('Type a name to mention someone.'),
		formattingLabel: t('Formatting'),
		boldLabel: t('Bold'),
		italicLabel: t('Italic'),
		strikethroughLabel: t('Strikethrough'),
		codeLabel: t('Code'),
		linkLabel: t('Link'),
		highlightLabel: t('Highlight'),
		quoteLabel: t('Quote'),
		mentionLabel: t('Mention')
	});
	const excludeUserId = $derived(page.data.user?.id ?? '');
	const memberReplaysHref = $derived(href('/replays?tab=member'));
	const fromMatchId = $derived(data.fromMatch?.id ?? '');
	const matchHref = $derived(fromMatchId ? href(`/replays/${fromMatchId}`) : '');
	const pageTitle = $derived(fromMatchId ? t('Publish replay') : t('Upload replay'));

	let fileName = $state<string | null>(null);
	let parseError = $state<string | null>(null);
	let parsePending = $state(false);
	let parseId = $state<number | null>(null);
	let actionsLoaded = $state(false);
	let actionsPending = $state(false);
	let description = $state('');
	let title = $state('');
	let tab = $state('overview');
	let parsed = $state.raw<ParsedReplay | null>(null);
	let isRanked = $state(false);
	let linkedLabels = $state.raw<Record<string, string>>({});
	let publishPending = $state(false);
	let publishError = $state<string | null>(null);
	let formMeta = $state({
		filename: '',
		mapName: 'Unknown',
		mapFilename: 'Unknown',
		durationInSeconds: '0',
		gameDate: '',
		isRanked: 'false',
		isVpGame: 'false',
		isRandomStart: 'false',
		isHighResources: 'false',
		vpCount: '0',
		players: '[]',
		messages: '[]'
	});

	const formError = $derived.by(() => {
		if (parseError) {
			return parseError;
		}

		if (publishError) {
			return publishError;
		}

		const issue = uploadMemberReplay.fields.allIssues()?.[0]?.message;
		return issue ? t(issue) : null;
	});
	const titleValid = $derived(title.trim().length > 0);
	const descriptionValid = $derived(description.trim().length > 0);
	const requiredFieldsHint = $derived.by(() => {
		if (titleValid && descriptionValid) {
			return null;
		}

		if (!titleValid && !descriptionValid) {
			return t('Title and description are required.');
		}

		if (!titleValid) {
			return t('Title is required.');
		}

		return t('Description is required.');
	});
	const canPublish = $derived(
		titleValid &&
			descriptionValid &&
			!!parsed &&
			!publishPending &&
			!uploadMemberReplay.pending &&
			(!fromMatchId || !!parsed)
	);
	const hasReplay = $derived(!!parsed);
	const mapLabel = $derived.by(() => {
		if (!parsed) {
			return pageTitle;
		}

		const raw = parsed.mapFileName || parsed.mapName || 'Unknown';
		return normalizeMapName(raw.split(/[/\\]/).pop() ?? raw);
	});
	const durationLabel = $derived(parsed ? formatDurationSeconds(parsed.duration) : t('N/A'));
	const submittedAt = $derived(
		parsed ? formatSubmittedAt(parsed.gameDate || new Date().toISOString(), currentLocale()) : '—'
	);
	const playerCount = $derived(parsed?.playerCount || parsed?.players?.length || 0);
	const replayData = $derived(parsed as unknown as ReplayData | null);
	const steamLinkPlayers = $derived.by((): ReplaySteamLinkPlayer[] => {
		if (!parsed?.players?.length) {
			return [];
		}

		return parsed.players.map((player, index) => {
			const steamId = player.steamId ? String(player.steamId) : null;
			return {
				key: String(index),
				name: player.name || `Player ${index + 1}`,
				faction: player.faction,
				steamId,
				linkedLabel: steamId ? (linkedLabels[steamId] ?? null) : null
			};
		});
	});

	const ratingPreview = resource(
		() =>
			parsed
				? {
						players: (parsed.players ?? []).map((player) => ({
							name: player.name,
							steamId:
								player.steamId != null && String(player.steamId).trim()
									? String(player.steamId)
									: null,
							faction: player.faction,
							id:
								typeof player.id === 'number' && Number.isFinite(player.id) ? player.id : undefined
						})),
						isRanked,
						durationInSeconds: parsed.duration || 0
					}
				: null,
		(input) =>
			input
				? previewMemberReplayRatings(input)
				: Promise.resolve({ matchtype_id: 0, players: [], livePlayers: [] })
	);
	const composeLoading = $derived(parsePending || (!!fileName && !parsed && !parseError));

	const previewMatch = $derived.by((): CommunityMatchDetail | null => {
		if (!parsed) {
			return null;
		}

		const preview = ratingPreview.current;
		const communityPlayers: CommunityPlayer[] = (parsed.players ?? []).map((player, index) => {
			const result = preview?.players?.[index];
			const live = preview?.livePlayers?.[index];
			const steamId = player.steamId
				? String(player.steamId)
				: live?.steamId
					? String(live.steamId)
					: null;
			const fromResult = Number(result?.profile_id);
			const fromLive = Number(live?.profileId);
			const fromReplay = Number(player.id);
			const profileId =
				(Number.isFinite(fromResult) && fromResult > 0 ? fromResult : 0) ||
				(Number.isFinite(fromLive) && fromLive > 0 ? fromLive : 0) ||
				(Number.isFinite(fromReplay) && fromReplay > 0 && fromReplay < 1000 ? fromReplay : 0) ||
				index + 1;
			return {
				playerId: profileId,
				steamId,
				race: raceFromReplayFaction(player.faction || ''),
				faction: player.faction,
				doctrineName: player.doctrineName,
				profile: {
					profile_id: profileId,
					alias: player.name || result?.alias || `Player ${index + 1}`
				}
			};
		});

		return {
			id: 'preview',
			kind: 'member',
			map: parsed.mapName || parsed.mapFileName || 'Unknown',
			title: '',
			isRanked,
			createdAt: parsed.gameDate || new Date().toISOString(),
			durationSeconds: parsed.duration || null,
			likeCount: 0,
			downloadCount: 0,
			replay: fileName || 'replay.rec',
			hasReplay: true,
			players: communityPlayers,
			livePlayers: preview?.livePlayers ?? [],
			result: {
				matchtype_id: preview?.matchtype_id,
				startgametime: 0,
				completiontime: parsed.duration || 0,
				players: preview?.players ?? []
			},
			description
		};
	});

	function resetSelection() {
		parsed = null;
		fileName = null;
		parseError = null;
		parsePending = false;
		parseId = null;
		actionsLoaded = false;
		actionsPending = false;
		description = '';
		title = '';
		tab = 'overview';
		isRanked = false;
		linkedLabels = {};
		formMeta = {
			filename: '',
			mapName: 'Unknown',
			mapFilename: 'Unknown',
			durationInSeconds: '0',
			gameDate: '',
			isRanked: 'false',
			isVpGame: 'false',
			isRandomStart: 'false',
			isHighResources: 'false',
			vpCount: '0',
			players: '[]',
			messages: '[]'
		};
	}

	function doctrineBannerForPlayer(player: ReplayPlayer) {
		return doctrineBannerUrl(player as ParsedReplayPlayer);
	}

	function countedActionsForReplay(data: ReplayData, playerId: number | null) {
		return countedActions(data as ParsedReplay, playerId ?? undefined) as ReplayAction[];
	}

	function playerCpmForReplay(data: ReplayData, playerId: number | null) {
		return playerCpm(data as ParsedReplay, playerId ?? undefined);
	}

	function linkPlayerSteam(key: string, steamId: string | null, label?: string | null) {
		if (!parsed?.players) {
			return;
		}

		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index >= parsed.players.length) {
			return;
		}

		const previous = parsed.players[index]?.steamId ? String(parsed.players[index]?.steamId) : null;
		const nextPlayers = parsed.players.map((player, playerIndex) => {
			if (playerIndex !== index) {
				return player;
			}

			if (!steamId) {
				return { ...player, steamId: undefined };
			}

			return { ...player, steamId: String(steamId) };
		});

		parsed = { ...parsed, players: nextPlayers };
		formMeta = { ...formMeta, players: JSON.stringify(nextPlayers) };

		if (steamId && label?.trim()) {
			linkedLabels = { ...linkedLabels, [String(steamId)]: label.trim() };
			return;
		}

		if (!steamId && previous) {
			const nextLabels = { ...linkedLabels };
			delete nextLabels[previous];
			linkedLabels = nextLabels;
		}
	}

	async function searchPlayers(query: string) {
		const q = query.trim();
		if (!q) {
			return [];
		}

		const results = await searchPlayersForUpload({ q });
		if (results.length > 0) {
			return results.map((player) => ({
				value: player.value,
				label: player.label,
				avatarUrl: player.avatarUrl ?? null,
				country: player.country ?? null,
				profileId: player.profileId ?? null
			}));
		}

		if (isValidSteamId(q)) {
			return [{ value: q, label: q, avatarUrl: null, country: null, profileId: null }];
		}

		return [];
	}

	function resolvePlayerProfileHref(steamId: string, profileId?: number | null) {
		const id = profileId && profileId > 0 ? profileId : steamId;
		return href(`/players/${id}`);
	}

	async function onFilePicked(file: File | null) {
		parseError = null;
		parsed = null;
		description = '';
		title = '';
		tab = 'overview';
		fileName = file?.name ?? null;
		if (!file) {
			parsePending = false;
			return;
		}

		parsePending = true;
		parseId = null;
		await tick();
		try {
			const buffer = await file.arrayBuffer();
			const { parseId: nextParseId, replay } = await parseReplayAsync(buffer);
			const parsedReplay = replay as ParsedReplay;
			if (!Array.isArray(parsedReplay.players) || parsedReplay.players.length === 0) {
				throw new Error('empty-players');
			}

			const ranked = parsedReplay.matchType?.toLowerCase().includes('automatch') ?? false;
			const mapFilename = parsedReplay.mapFileName || parsedReplay.mapName || 'Unknown';
			const mapNameRaw = parsedReplay.mapName || 'Unknown';
			const mapName = /^\$\d+$/.test(mapNameRaw)
				? mapFilename.split(/[/\\]/).pop() || mapNameRaw
				: mapNameRaw;
			const nextTitle =
				parsedReplay.replayName?.trim() ||
				normalizeMapName(
					(parsedReplay.mapFileName || parsedReplay.mapName || file.name).split(/[/\\]/).pop() ??
						file.name
				) ||
				'-';
			isRanked = ranked;
			title = nextTitle;
			linkedLabels = {};
			parseId = nextParseId;
			actionsLoaded = false;
			parsed = parsedReplay;
			formMeta = {
				filename: file.name,
				mapName,
				mapFilename,
				durationInSeconds: String(parsedReplay.duration || 0),
				gameDate: parsedReplay.gameDate || '',
				isRanked: ranked ? 'true' : 'false',
				isVpGame: parsedReplay.vpGame ? 'true' : 'false',
				isRandomStart: parsedReplay.randomStart ? 'true' : 'false',
				isHighResources: parsedReplay.highResources ? 'true' : 'false',
				vpCount: String(parsedReplay.vpCount || 0),
				players: JSON.stringify(parsedReplay.players ?? []),
				messages: JSON.stringify(parsedReplay.messages ?? [])
			};
			await tick();
		} catch {
			parseError = t('Could not parse that replay file.');
			fileName = null;
			parsed = null;
			parseId = null;
			title = '';
			linkedLabels = {};
			formMeta = {
				filename: '',
				mapName: 'Unknown',
				mapFilename: 'Unknown',
				durationInSeconds: '0',
				gameDate: '',
				isRanked: 'false',
				isVpGame: 'false',
				isRandomStart: 'false',
				isHighResources: 'false',
				vpCount: '0',
				players: '[]',
				messages: '[]'
			};
		} finally {
			parsePending = false;
		}
	}

	async function loadFromMatch(match: CommunityMatchDetail) {
		parseError = null;
		publishError = null;
		parsePending = true;
		try {
			const response = await fetch(`/api/replay-file/${match.id}`);
			if (!response.ok) {
				throw new Error(t('This match has no replay file.'));
			}

			const buffer = await response.arrayBuffer();
			const name = match.replay || `${match.id}.rec`;
			const nextFile = new File([buffer], name, { type: 'application/octet-stream' });
			await onFilePicked(nextFile);
			if (!title.trim()) {
				title =
					(match.title && match.title !== '-' ? match.title : '') ||
					normalizeMapName(match.map) ||
					t('Untitled replay');
			}
		} catch (error) {
			parseError =
				error instanceof Error ? error.message : t('Failed to publish replay.');
			fileName = null;
			parsed = null;
		} finally {
			parsePending = false;
		}
	}

	async function onPublishFromMatch() {
		if (!fromMatchId || !parsed || publishPending || !titleValid || !descriptionValid) {
			return;
		}

		publishPending = true;
		publishError = null;
		try {
			const published = await publishMatchAsMemberReplay({
				lobbyId: fromMatchId,
				title: title.trim() || '-',
				description: description.trim(),
				durationInSeconds: parsed.duration || 0,
				players: parsed.players
			});
			await goto(href(`/replays/${published.id}`));
		} catch (error) {
			publishError =
				error instanceof Error ? error.message : t('Failed to publish replay.');
			publishPending = false;
		}
	}

	$effect(() => {
		const match = data.fromMatch;
		if (!match) {
			return;
		}

		let cancelled = false;
		void loadFromMatch(match).then(() => {
			if (cancelled) {
				return;
			}
		});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (tab !== 'timeline' || !parsed || parseId == null || actionsLoaded) {
			return;
		}

		const id = parseId;
		let cancelled = false;
		actionsPending = true;
		void loadReplayActionsAsync(id)
			.then((actions) => {
				if (cancelled || !parsed) {
					return;
				}

				parsed = {
					...parsed,
					actions: actions as ParsedReplay['actions']
				};
				actionsLoaded = true;
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
</script>

<svelte:head>
	<title>{pageTitle} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={fromMatchId
			? t('Publish this match to Member replays. It will leave Community matches.')
			: t('Upload a Company of Heroes .rec file to share it in Member replays.')}
	/>
</svelte:head>

<form
	{...fromMatchId ? {} : uploadMemberReplay}
	enctype="multipart/form-data"
	onsubmit={(event) => {
		if (!fromMatchId) {
			return;
		}

		event.preventDefault();
		void onPublishFromMatch();
	}}
>
	<!-- Remote form `.as('hidden', value)` uses the second arg as the submitted value (not fields.set). -->
	<input {...uploadMemberReplay.fields.filename.as('hidden', formMeta.filename || '')} />
	<input {...uploadMemberReplay.fields.title.as('hidden', title)} />
	<input {...uploadMemberReplay.fields.description.as('hidden', description)} />
	<input {...uploadMemberReplay.fields.mapName.as('hidden', formMeta.mapName)} />
	<input {...uploadMemberReplay.fields.mapFilename.as('hidden', formMeta.mapFilename)} />
	<input
		{...uploadMemberReplay.fields.durationInSeconds.as('hidden', formMeta.durationInSeconds)}
	/>
	<input {...uploadMemberReplay.fields.gameDate.as('hidden', formMeta.gameDate || '')} />
	<input {...uploadMemberReplay.fields.isRanked.as('hidden', formMeta.isRanked)} />
	<input {...uploadMemberReplay.fields.isVpGame.as('hidden', formMeta.isVpGame)} />
	<input {...uploadMemberReplay.fields.isRandomStart.as('hidden', formMeta.isRandomStart)} />
	<input {...uploadMemberReplay.fields.isHighResources.as('hidden', formMeta.isHighResources)} />
	<input {...uploadMemberReplay.fields.vpCount.as('hidden', formMeta.vpCount)} />
	<input {...uploadMemberReplay.fields.players.as('hidden', formMeta.players)} />
	<input {...uploadMemberReplay.fields.messages.as('hidden', formMeta.messages)} />

	<!-- Keep dropzone mounted so the remote file field survives after parse. -->
	<div
		class={cn('border-secondary-800 border-b border-dashed', hasReplay && !parseError && 'hidden')}
	>
		<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
			<a
				href={memberReplaysHref}
				aria-label={t('Go back')}
				class={cn(
					interactive,
					'border-secondary-600 bg-secondary-800 hover:border-secondary-500 hover:bg-secondary-700 inline-flex size-9 shrink-0 items-center justify-center rounded-md border text-white'
				)}
			>
				<ArrowLeftIcon class="size-4" weight="duotone" />
			</a>
			<nav aria-label="Breadcrumb" class="font-heading min-w-0 text-sm font-bold">
				<ol class="flex items-center">
					<li>
						<a
							href={memberReplaysHref}
							class={cn(interactive, 'text-secondary-400 hover:text-primary')}
						>
							{t('Replays')}
						</a>
					</li>
					<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
					<li class="min-w-0 truncate text-white">{pageTitle}</li>
				</ol>
			</nav>
		</div>
		<div class="px-4 py-3">
			<p class="text-secondary-400 text-sm">
				{#if fromMatchId}
					{t('Publish this match to Member replays. It will leave Community matches.')}
				{:else}
					{t('Upload a Company of Heroes .rec file to share it in Member replays.')}
				{/if}
			</p>
		</div>
		{#if !fromMatchId}
			<div class={cn(composeLoading && 'hidden')}>
				<FileDropzone
					id="member-replay-file"
					flush
					{fileName}
					busy={!!uploadMemberReplay.pending || parsePending}
					label={t('Replay file')}
					dropLabel={t('Drop a .rec file here')}
					browseLabel={t('or click to browse')}
					changeFileLabel={t('Change file')}
					inputProps={uploadMemberReplay.fields.file.as('file')}
					onFileChange={(file) => void onFilePicked(file)}
				/>
			</div>
		{/if}
		{#if composeLoading}
			<div class="border-secondary-800 border-t px-4 py-6">
				<p class="text-secondary-400 text-sm">{t('Loading…')}</p>
			</div>
		{:else if formError}
			<p class="text-destructive border-secondary-800 border-t px-4 py-3 text-sm" role="alert">
				{formError}
			</p>
		{/if}
	</div>

	{#if previewMatch && replayData && parsed && !composeLoading}
		{@const match = previewMatch}
		{@const parsedReplay = parsed}
		<DetailHeader
			mapName={mapLabel}
			map={match.map}
			downloadCount={0}
			listHref={memberReplaysHref}
			{resolveMapSrc}
			showDownload={false}
			replaysLabel={t('Replays')}
			backAriaLabel={t('Go back')}
		>
			{#snippet details()}
				<div class={detailMetaGrid}>
					<List.Title>{t('Title')}</List.Title>
					<List.Value>
						{#if isRanked}
							<span class="flex items-center" title={t('Ranked match')}>
								<RankingIcon class="text-primary-100" weight="duotone" />
							</span>
						{:else}
							<span class="truncate">{mapLabel}</span>
						{/if}
					</List.Value>

					<List.Title>{t('Submitted at')}</List.Title>
					<List.Value>{submittedAt}</List.Value>
					<List.Title>{t('Player count')}</List.Title>
					<List.Value>{playerCount}</List.Value>

					<List.Title>{t('Game mode')}</List.Title>
					<List.Value>{isRanked ? t('Ranked') : t('Custom match')}</List.Value>
					<List.Title>{t('Duration')}</List.Title>
					<List.Value>{durationLabel}</List.Value>
				</div>
			{/snippet}
			{#snippet actions()}
				<div class="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
					<div class="flex flex-wrap items-center gap-2">
						<Button
							type="submit"
							loading={!!uploadMemberReplay.pending || publishPending}
							disabled={!canPublish}
						>
							{t('Publish')}
						</Button>
						{#if fromMatchId && matchHref}
							<Button
								type="button"
								variant="secondary"
								disabled={!!uploadMemberReplay.pending || publishPending}
								href={matchHref}
							>
								{t('Back to match')}
							</Button>
						{:else}
							<Button
								type="button"
								variant="secondary"
								disabled={!!uploadMemberReplay.pending || publishPending}
								onclick={resetSelection}
							>
								{t('Choose another file')}
							</Button>
						{/if}
					</div>
					{#if requiredFieldsHint}
						<p class="text-secondary-400 text-sm sm:text-right">{requiredFieldsHint}</p>
					{/if}
				</div>
			{/snippet}
		</DetailHeader>

		<Form.Group
			label={t('Title')}
			inputId="member-replay-title"
			wide
			required
			requiredLabel={t('required')}
		>
			<Input
				id="member-replay-title"
				bind:value={title}
				required
				maxlength={200}
				placeholder={t('Title')}
				aria-required="true"
			/>
		</Form.Group>

		<Form.Group
			label={t('Description')}
			inputId="member-replay-description"
			wide
			required
			requiredLabel={t('required')}
		>
			<CommentComposer
				id="member-replay-description"
				bind:value={description}
				boxed
				showSubmit={false}
				placeholder={t('Write a description')}
				searchMentions={searchMentionUsers}
				{excludeUserId}
				{...composerLabels}
			/>
		</Form.Group>

		{#if steamLinkPlayers.length > 0}
			<PlayerSteamLinks
				players={steamLinkPlayers}
				onLink={linkPlayerSteam}
				onSearchPlayers={searchPlayers}
				{resolveFactionFlag}
				raceFromFaction={raceFromReplayFaction}
				{resolveAvatarUrl}
				{flagImageUrl}
				resolvePlayerHref={resolvePlayerProfileHref}
				playersLabel={t('Players')}
				hint={t(
					'Link a Steam account when the replay has no Steam ID so ratings and flags can load.'
				)}
				searchPlaceholder={t('Search player...')}
				linkedLabel={t('Linked')}
				clearLabel={t('Clear')}
				viewProfileLabel={t('View profile')}
				noResultsLabel={t('No results found.')}
				searchingLabel={t('Searching...')}
			/>
		{/if}

		{#if formError}
			<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{formError}</p>
		{/if}

		<Tabs
			bind:value={tab}
			overviewLabel={t('Overview')}
			chatLabel={t('Chat')}
			timelineLabel={t('Timeline')}
		>
			{#snippet overview()}
				<Overview
					{match}
					replay={replayData}
					livePlayers={match.livePlayers ?? []}
					playerHref={resolvePlayerHref}
					{flagImageUrl}
					{getCountryDisplayName}
					{resolveFactionFlag}
					{raceFromReplayFaction}
					doctrineBannerUrl={doctrineBannerForPlayer}
					playerCpm={playerCpmForReplay}
					getRankImage={getRankImageByRace}
					levelLabel={t('Lv')}
					alliesLabel={t('Allies')}
					axisLabel={t('Axis')}
					unknownDoctrineLabel={t('Unknown doctrine')}
					ratingLabel={t('Rating')}
					cpmLabel={t('CPM')}
				/>
			{/snippet}
			{#snippet chat()}
				{#if tab === 'chat'}
					<Chat
						messages={parsedReplay.messages}
						playerCount={parsedReplay.playerCount}
						emptyMessage={t('No messages')}
					/>
				{/if}
			{/snippet}
			{#snippet timeline()}
				{#if tab === 'timeline'}
					{#if actionsPending}
						<p class="text-secondary-400 px-4 py-6 text-sm">{t('Loading…')}</p>
					{:else}
						<Actions
							replay={replayData}
							countedActions={countedActionsForReplay}
							{resolveFactionFlag}
							{raceFromReplayFaction}
						/>
					{/if}
				{/if}
			{/snippet}
		</Tabs>
	{/if}
</form>
