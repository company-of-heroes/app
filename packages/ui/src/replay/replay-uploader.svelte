<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource } from 'runed';
	import { tick } from 'svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import { cn } from '../cn';
	import CommentComposer from '../comment/comment-composer.svelte';
	import { normalizeMapName } from '../format/player-format';
	import { useHost, type ReplayRosterPlayer } from '../host/host.context';
	import { Button } from '../ui/button';
	import * as Form from '../ui/form';
	import { Input } from '../ui/input';
	import * as List from '../ui/list';
	import { detailMetaGrid, interactive } from '../variants';
	import { loadReplayActionsAsync, parseReplayAsync } from './parse/parse-replay-async';
	import ReplayActions from './replay-actions.svelte';
	import ReplayChat from './replay-chat.svelte';
	import ReplayDetailHeader from './replay-detail-header.svelte';
	import ReplayFileDropzone from './replay-file-dropzone.svelte';
	import ReplayOverview from './replay-overview.svelte';
	import ReplayPlayerSteamLinks, {
		type ReplaySteamLinkPlayer
	} from './replay-player-steam-links.svelte';
	import { raceFromReplayFaction } from './replay-stats';
	import ReplayRoot from './replay-root.svelte';
	import ReplayTabs from './replay-tabs.svelte';
	import type {
		CommunityMatchDetail,
		CommunityPlayer,
		ReplayAction,
		ReplayData,
		ReplayMessage
	} from './types';
	import { formatDurationSeconds, formatMatchDate } from './utils';
	import { tooltip } from '../attachments';

	type ParsedReplay = {
		players: ReplayRosterPlayer[];
		duration: number;
		messages: ReplayMessage[];
		actions: ReplayAction[];
		cpmByPlayerId?: Record<string, string>;
		matchType: string;
		mapFileName: string;
		mapName: string;
		replayName: string;
		gameDate?: string;
		vpGame?: boolean;
		vpCount?: number;
		playerCount: number;
		randomStart?: boolean;
		highResources?: boolean;
	};

	type Props = {
		/** Publish this saved match (lobby id) instead of uploading a new file. */
		fromMatchId?: string;
		/** Back link + breadcrumb row; the desktop app renders its own breadcrumbs. */
		showNav?: boolean;
	};

	let { fromMatchId = '', showNav = true }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const memberReplaysHref = $derived(host.routes.memberReplays());
	const matchHref = $derived(fromMatchId ? host.routes.match(fromMatchId) : '');
	const pageTitle = $derived(fromMatchId ? t('Publish replay') : t('Upload replay'));

	let file = $state<File | null>(null);
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
	/** The saved match's own Relic result (publish from match); it outranks the ladder preview. */
	let matchResult = $state.raw<CommunityMatchDetail['result'] | null>(null);
	let linkedLabels = $state.raw<Record<string, string>>({});
	let submitError = $state<string | null>(null);
	let busy = $state(false);

	const formError = $derived(parseError || submitError);
	const titleValid = $derived(title.trim().length > 0);
	const descriptionValid = $derived(description.trim().length > 0);
	const requiredFieldsHint = $derived.by(() => {
		if (titleValid && descriptionValid) {
			return null;
		}

		if (!titleValid && !descriptionValid) {
			return t('Title and description are required.');
		}

		return titleValid ? t('Description is required.') : t('Title is required.');
	});
	const canPublish = $derived(
		titleValid && descriptionValid && !!parsed && !busy && (!!file || !!fromMatchId)
	);
	const hasReplay = $derived(!!parsed);
	const mapLabel = $derived.by(() => {
		if (!parsed) {
			return pageTitle;
		}

		const raw = parsed.mapFileName || parsed.mapName || 'Unknown';
		const fileBase = raw.split(/[/\\]/).pop() ?? raw;
		if (/^\$\d+$/.test(parsed.mapName || '')) {
			return host.resolve.gameString?.(parsed.mapName) || normalizeMapName(fileBase);
		}

		return normalizeMapName(fileBase);
	});
	const durationLabel = $derived(parsed ? formatDurationSeconds(parsed.duration) : t('N/A'));
	const submittedAt = $derived(
		parsed ? formatMatchDate(parsed.gameDate || new Date().toISOString(), host.locale()) : '—'
	);
	const playerCount = $derived(parsed?.playerCount || parsed?.players?.length || 0);
	const replayData = $derived(parsed as unknown as ReplayData | null);
	const composeLoading = $derived(parsePending || (!!fileName && !parsed && !parseError));
	const steamLinkPlayers = $derived.by((): ReplaySteamLinkPlayer[] =>
		(parsed?.players ?? []).map((player, index) => {
			const steamId = player.steamId ? String(player.steamId) : null;
			return {
				key: String(index),
				name: player.name || t('Player {n}', { n: index + 1 }),
				faction: player.faction,
				steamId,
				linkedLabel: steamId ? (linkedLabels[steamId] ?? null) : null
			};
		})
	);

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
		async (input) => {
			const empty = { matchtype_id: 0, players: [], livePlayers: [] };
			return input ? host.api.replays.previewRatings(input).catch(() => empty) : empty;
		}
	);

	const previewMatch = $derived.by((): CommunityMatchDetail | null => {
		if (!parsed) {
			return null;
		}

		const preview = ratingPreview.current;
		const players: CommunityPlayer[] = (parsed.players ?? []).map((player, index) => {
			const result = preview?.players?.[index];
			const live = preview?.livePlayers?.[index];
			const steamId = player.steamId
				? String(player.steamId)
				: live?.steamId
					? String(live.steamId)
					: null;
			const fromResult = Number(result?.profile_id);
			const fromLive = Number(live?.profileId);
			const profileId =
				(Number.isFinite(fromResult) && fromResult > 0 ? fromResult : 0) ||
				(Number.isFinite(fromLive) && fromLive > 0 ? fromLive : 0);
			return {
				playerId: profileId > 0 ? profileId : -1,
				steamId,
				race: raceFromReplayFaction(player.faction || ''),
				faction: player.faction,
				doctrineName: player.doctrineName,
				profile: {
					profile_id: profileId,
					alias: player.name || result?.alias || t('Player {n}', { n: index + 1 })
				}
			};
		});

		return {
			id: 'preview',
			kind: 'member',
			map: parsed.mapFileName || parsed.mapName || 'Unknown',
			title: '',
			isRanked,
			createdAt: parsed.gameDate || new Date().toISOString(),
			durationSeconds: parsed.duration || null,
			likeCount: 0,
			downloadCount: 0,
			players,
			result: matchResult ?? {
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
		file = null;
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
		matchResult = null;
		linkedLabels = {};
		submitError = null;
		busy = false;
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

			return { ...player, steamId: steamId ? String(steamId) : undefined };
		});
		parsed = { ...parsed, players: nextPlayers };

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

	/** The .rec has no Steam ids; take them from the saved match by player name. */
	function linkMatchPlayers(players: { name: string; steamId: string | null }[]) {
		if (!parsed?.players) {
			return;
		}

		const key = (name: string | undefined) => (name ?? '').trim().toLowerCase();
		const byName = new Map(
			players
				.filter((player) => player.steamId && key(player.name))
				.map((player) => [key(player.name), String(player.steamId)])
		);
		if (byName.size === 0) {
			return;
		}

		parsed = {
			...parsed,
			players: parsed.players.map((player) => {
				const steamId = byName.get(key(player.name));
				return player.steamId || !steamId ? player : { ...player, steamId };
			})
		};
	}

	async function onFilePicked(next: File | null) {
		parseError = null;
		submitError = null;
		parsed = null;
		description = '';
		title = '';
		tab = 'overview';
		file = next;
		fileName = next?.name ?? null;
		if (!next) {
			parsePending = false;
			return;
		}

		parsePending = true;
		parseId = null;
		await tick();
		try {
			const buffer = await next.arrayBuffer();
			const { parseId: nextParseId, replay } = await parseReplayAsync(buffer);
			const parsedReplay = replay as unknown as ParsedReplay;
			if (!Array.isArray(parsedReplay.players) || parsedReplay.players.length === 0) {
				throw new Error('empty-players');
			}

			isRanked = parsedReplay.matchType?.toLowerCase().includes('automatch') ?? false;
			title =
				parsedReplay.replayName?.trim() ||
				normalizeMapName(
					(parsedReplay.mapFileName || parsedReplay.mapName || next.name).split(/[/\\]/).pop() ??
						next.name
				) ||
				'-';
			linkedLabels = {};
			parseId = nextParseId;
			actionsLoaded = false;
			parsed = { ...parsedReplay, actions: parsedReplay.actions ?? [] };
			await tick();
		} catch {
			parseError = t('Could not parse that replay file.');
			file = null;
			fileName = null;
			parsed = null;
			parseId = null;
			title = '';
			linkedLabels = {};
		} finally {
			parsePending = false;
		}
	}

	async function loadFromMatch(lobbyId: string) {
		parseError = null;
		submitError = null;
		parsePending = true;
		try {
			const match = await host.api.replays.loadMatchForPublish(lobbyId);
			if (!match) {
				return;
			}

			await onFilePicked(match.file);
			linkMatchPlayers(match.players ?? []);
			if (match.isRanked !== undefined) {
				isRanked = match.isRanked;
			}

			matchResult = match.result?.players?.length ? match.result : null;
			if (!title.trim()) {
				title =
					(match.title && match.title !== '-' ? match.title : '') ||
					(match.map ? normalizeMapName(match.map) : '') ||
					t('Untitled replay');
			}
		} catch (error) {
			parseError = error instanceof Error ? error.message : t('Failed to publish replay.');
			file = null;
			fileName = null;
			parsed = null;
		} finally {
			parsePending = false;
		}
	}

	async function onPublish() {
		if (!parsed || busy || !titleValid || !descriptionValid) {
			return;
		}

		busy = true;
		submitError = null;
		try {
			if (fromMatchId) {
				const published = await host.api.replays.publishFromMatch(fromMatchId, {
					title: title.trim() || '-',
					description: description.trim(),
					durationInSeconds: parsed.duration || 0,
					players: parsed.players
				});
				host.notify.success(t('Replay published to Shared Replays.'));
				await host.url.goto(host.routes.memberReplay(published.id));
				return;
			}

			if (!file) {
				busy = false;
				return;
			}

			const mapFilename = parsed.mapFileName || parsed.mapName || 'Unknown';
			const mapNameRaw = parsed.mapName || 'Unknown';
			const uploaded = await host.api.replays.upload({
				file,
				filename: file.name,
				title: title.trim() || '-',
				description: description.trim(),
				mapName: /^\$\d+$/.test(mapNameRaw)
					? mapFilename.split(/[/\\]/).pop() || mapNameRaw
					: mapNameRaw,
				mapFilename,
				durationInSeconds: parsed.duration || 0,
				gameDate: parsed.gameDate || undefined,
				isRanked,
				isVpGame: Boolean(parsed.vpGame),
				isRandomStart: Boolean(parsed.randomStart),
				isHighResources: Boolean(parsed.highResources),
				vpCount: parsed.vpCount || 0,
				players: parsed.players,
				messages: parsed.messages ?? []
			});
			host.notify.success(t('Replay uploaded to Shared Replays.'));
			await host.url.goto(host.routes.memberReplay(uploaded.id));
		} catch (error) {
			submitError =
				error instanceof Error
					? t(error.message)
					: fromMatchId
						? t('Failed to publish replay.')
						: t('Failed to upload replay.');
			busy = false;
		}
	}

	$effect(() => {
		if (fromMatchId) {
			void loadFromMatch(fromMatchId);
		}
	});

	$effect(() => {
		// The timeline is part of the overview, so actions load as soon as the file is parsed.
		if (!parsed || parseId == null || actionsLoaded) {
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

				parsed = { ...parsed, actions: actions as ReplayAction[] };
				actionsLoaded = true;
				actionsPending = false;
			})
			.catch(() => {
				if (!cancelled) {
					actionsLoaded = true;
					actionsPending = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class={cn('border-secondary-800 border-b border-dashed', hasReplay && !parseError && 'hidden')}
>
	{#if showNav}
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
	{/if}
	<div class="px-4 py-3">
		<p class="text-secondary-400 text-sm">
			{#if fromMatchId}
				{t('Publish this match to Shared Replays. It will leave Community matches.')}
			{:else}
				{t('Upload a Company of Heroes .rec file to share it in Shared Replays.')}
			{/if}
		</p>
	</div>
	{#if !fromMatchId}
		<div class={cn(composeLoading && 'hidden')}>
			<ReplayFileDropzone
				id="member-replay-file"
				flush
				{fileName}
				busy={busy || parsePending}
				onFileChange={(next) => void onFilePicked(next)}
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
	<ReplayDetailHeader
		mapName={mapLabel}
		map={match.map}
		downloadCount={0}
		listHref={memberReplaysHref}
		showDownload={false}
		{showNav}
	>
		{#snippet details()}
			<div class={detailMetaGrid}>
				<List.Title>{t('Title')}</List.Title>
				<List.Value>
					{#if isRanked}
						<span class="flex items-center" {@attach tooltip(t('Ranked match'))}>
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
						type="button"
						loading={busy}
						disabled={!canPublish}
						onclick={() => void onPublish()}
					>
						{t('Publish')}
					</Button>
					{#if fromMatchId && matchHref}
						<Button type="button" variant="secondary" disabled={busy} href={matchHref}>
							{t('Back to match')}
						</Button>
					{:else}
						<Button type="button" variant="secondary" disabled={busy} onclick={resetSelection}>
							{t('Choose another file')}
						</Button>
					{/if}
				</div>
				{#if requiredFieldsHint}
					<p class="text-secondary-400 text-sm sm:text-right">{requiredFieldsHint}</p>
				{/if}
			</div>
		{/snippet}
	</ReplayDetailHeader>

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
			disabled={busy}
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
			searchMentions={(query) => host.api.comments.searchMentions(query)}
			excludeUserId={host.auth.user?.id ?? ''}
		/>
	</Form.Group>

	{#if steamLinkPlayers.length > 0}
		<ReplayPlayerSteamLinks players={steamLinkPlayers} onLink={linkPlayerSteam} />
	{/if}

	{#if formError}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{formError}</p>
	{/if}

	<ReplayRoot replay={replayData}>
		<ReplayTabs bind:value={tab}>
			{#snippet overview()}
				<ReplayOverview {match} livePlayers={ratingPreview.current?.livePlayers ?? []} />
				{#if actionsPending || (!actionsLoaded && parseId != null)}
					<p class="text-secondary-400 px-4 py-6 text-sm">{t('Loading…')}</p>
				{:else}
					<ReplayActions />
				{/if}
			{/snippet}
			{#snippet chat()}
				{#if tab === 'chat'}
					<ReplayChat />
				{/if}
			{/snippet}
		</ReplayTabs>
	</ReplayRoot>
{/if}
