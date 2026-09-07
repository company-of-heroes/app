<script lang="ts">
	import { resource } from 'runed';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import * as List from '$lib/components/ui/list';
	import {
		CommentComposer,
		type MentionUser as ComposerMentionUser
	} from '@company-of-heroes/ui/comment';
	import {
		Actions,
		Chat,
		DetailHeader,
		FileDropzone,
		Overview,
		PlayerSteamLinks,
		Tabs,
		formatDurationSeconds,
		formatMatchDate,
		type CommunityMatchDetail,
		type CommunityPlayer,
		type ReplayAction,
		type ReplayData,
		type ReplayPlayer,
		type ReplaySteamLinkPlayer
	} from '@company-of-heroes/ui/replay';
	import { detailMetaGrid } from '$lib/components/ui/variants';
	import { isValidSteamId } from '@company-of-heroes/api';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import type { MentionUser } from '$core/app/database/match-social';
	import { userAvatarSrc } from '$lib/components/user/user-avatar-src';
	import { getCountryDisplayName } from '$lib/components/leaderboard/leaderboard-utils';
	import { useI18n } from '$lib/i18n';
	import { cn, getFactionFlagFromRace, getRankImage, normalizeMapName } from '$lib/utils';
	import { getDefaultMapImage, getMapImageFromName, getString } from '$lib/utils/game';
	import { loadReplayActionsAsync, parseReplayAsync } from '$lib/utils/parse-replay-async';
	import DoctrineAir from '$lib/files/ct_branchbanner_top_allied_airborne.png?url';
	import DoctrineArmored from '$lib/files/ct_branchbanner_top_allied_armor.png?url';
	import DoctrineInfantry from '$lib/files/ct_branchbanner_top_allied_infantry.png?url';
	import DoctrineBlitz from '$lib/files/ct_branchbanner_top_axis_blitz.png?url';
	import DoctrineTerror from '$lib/files/ct_branchbanner_top_axis_terror.png?url';
	import DoctrineDefense from '$lib/files/ct_branchbanner_top_axis_defense.png?url';
	import DoctrineCwAir from '$lib/files/ct_branchbanner_top_cmnw_airborne.png?url';
	import DoctrineCwArmor from '$lib/files/ct_branchbanner_top_cmnw_armor.png?url';
	import DoctrineCwInfantry from '$lib/files/ct_branchbanner_top_cmnw_infantry.png?url';
	import DoctrineLuft from '$lib/files/ct_branchbanner_top_pnze_00.png?url';
	import DoctrineSector from '$lib/files/ct_branchbanner_top_pnze_01.png?url';
	import DoctrineTank from '$lib/files/ct_branchbanner_top_pnze_02.png?url';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';

	type ParsedReplayPlayer = {
		id?: number;
		name: string;
		faction: string;
		doctrine?: number;
		doctrineName?: string;
		steamId?: string | null;
	};

	type ParsedReplayAction = {
		playerID: number;
		tick: number;
		timestamp: string;
		commandID?: number;
		objectID?: number;
		command?: { type?: string; name?: string; description?: string } | null;
	};

	type ParsedReplayMessage = {
		playerID: number;
		sender: string;
		recipient: number;
		timestamp: string;
		content: string;
	};

	type ParsedReplay = {
		players: ParsedReplayPlayer[];
		duration: number;
		messages: ParsedReplayMessage[];
		actions: ParsedReplayAction[];
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

	const { t } = useI18n();
	const memberReplaysHref = '/history?tab=member';
	const fromMatchId = $derived(page.url.searchParams.get('fromMatch')?.trim() || '');
	const matchHref = $derived(fromMatchId ? `/history/${fromMatchId}` : '');
	const CPM_EXCLUDED_UNIT_COMMAND_IDS: ReadonlySet<number> = new Set([
		0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xa8
	]);

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
	let linkedLabels = $state.raw<Record<string, string>>({});
	let uploadError = $state<string | null>(null);
	let busy = $state(false);

	const formError = $derived(parseError || uploadError);
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
		titleValid && descriptionValid && !!parsed && !busy && (!!file || !!fromMatchId)
	);
	const hasReplay = $derived(!!parsed);
	const mapLabel = $derived.by(() => {
		if (!parsed) {
			return fromMatchId ? t('Publish replay') : t('Upload replay');
		}

		const mapName = parsed.mapName || '';
		const raw = parsed.mapFileName || parsed.mapName || 'Unknown';
		const fileBase = raw.split(/[/\\]/).pop() ?? raw;
		if (/^\$\d+$/.test(mapName)) {
			return getString(mapName) || normalizeMapName(fileBase);
		}

		return normalizeMapName(fileBase);
	});
	const durationLabel = $derived(parsed ? formatDurationSeconds(parsed.duration) : t('N/A'));
	const submittedAt = $derived(
		parsed ? formatMatchDate(parsed.gameDate || new Date().toISOString()) : '—'
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
	const composeLoading = $derived(parsePending || (!!fileName && !parsed && !parseError));

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
								typeof player.id === 'number' && Number.isFinite(player.id)
									? player.id
									: undefined
						})),
						isRanked,
						durationInSeconds: parsed.duration || 0
					}
				: null,
		async (input) => {
			if (!input) {
				return { matchtype_id: 0, players: [], livePlayers: [] };
			}

			try {
				return await unwrapApi(api.replays.previewMemberStats(input));
			} catch {
				return { matchtype_id: 0, players: [], livePlayers: [] };
			}
		}
	);

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
				(Number.isFinite(fromReplay) && fromReplay > 0 && fromReplay < 1000
					? fromReplay
					: 0) ||
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
			map: parsed.mapFileName || parsed.mapName || 'Unknown',
			title: '',
			isRanked,
			createdAt: parsed.gameDate || new Date().toISOString(),
			durationSeconds: parsed.duration || null,
			likeCount: 0,
			downloadCount: 0,
			players: communityPlayers,
			result: {
				matchtype_id: preview?.matchtype_id,
				startgametime: 0,
				completiontime: parsed.duration || 0,
				players: preview?.players ?? []
			},
			description
		};
	});

	function toComposerUser(user: MentionUser): ComposerMentionUser {
		return {
			id: user.id,
			name: user.name,
			avatarUrl: userAvatarSrc(user),
			steamIds: user.steamIds
		};
	}

	function searchMentions(query: string) {
		return app.database.matchSocial
			.searchMentionUsers(query)
			.then((users) => users.map(toComposerUser));
	}

	function raceFromReplayFaction(faction: string): number {
		const value = faction.toLowerCase();
		if (value.includes('commonwealth')) {
			return 2;
		}
		if (value.includes('panzer')) {
			return 3;
		}
		if (value.startsWith('axis')) {
			return 1;
		}
		return 0;
	}

	function resolveFactionFlag(raceId: number): string {
		return getFactionFlagFromRace(raceId);
	}

	function flagImageUrl(country: string | null | undefined): string | null {
		if (!country) {
			return null;
		}

		const region = String(country).trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(region)) {
			return null;
		}

		return `https://flagsapi.com/${region}/shiny/64.png`;
	}

	function resolveAvatarUrl(url: string): string {
		return url;
	}

	function resolvePlayerHref(steamId: string, profileId?: number | null) {
		const id = profileId && profileId > 0 ? String(profileId) : steamId;
		return `/players/${id}`;
	}

	function resolveOverviewPlayerHref(player: CommunityPlayer): string | null {
		if (player.playerId === -1) {
			return null;
		}

		const id = player.profile.profile_id;
		if (id > 0) {
			return `/players/${id}`;
		}

		return player.steamId ? `/players/${player.steamId}` : null;
	}

	function resolveMapSrc(map: string | undefined): string {
		return getMapImageFromName(map) || getDefaultMapImage();
	}

	function doctrineBannerUrl(player: ReplayPlayer & { doctrine?: number }): string | null {
		const doctrine = player.doctrine;
		if (doctrine == null) {
			return null;
		}

		if (player.faction.startsWith('allies')) {
			switch (doctrine) {
				case 2:
					return DoctrineAir;
				case 9:
					return DoctrineArmored;
				case 17:
					return DoctrineInfantry;
				case 316:
					return DoctrineCwInfantry;
				case 323:
					return DoctrineCwAir;
				case 330:
					return DoctrineCwArmor;
				default:
					return null;
			}
		}

		switch (doctrine) {
			case 186:
				return DoctrineBlitz;
			case 194:
				return DoctrineDefense;
			case 265:
				return DoctrineTerror;
			case 295:
				return DoctrineLuft;
			case 302:
				return DoctrineSector;
			case 309:
				return DoctrineTank;
			default:
				return null;
		}
	}

	function isAiTakeoverAction(action: ParsedReplayAction): boolean {
		return action.command?.type === 'AI_TAKEOVER';
	}

	function isCpmExcludedAction(action: ParsedReplayAction): boolean {
		if (isAiTakeoverAction(action)) {
			return true;
		}

		return (
			(action.commandID ?? -1) === 0x37 &&
			CPM_EXCLUDED_UNIT_COMMAND_IDS.has(action.objectID ?? -1)
		);
	}

	function countedActionsForReplay(data: ReplayData, playerId: number | null): ReplayAction[] {
		if (playerId == null) {
			return [];
		}

		const replay = data as unknown as ParsedReplay;
		const actions = (replay.actions ?? []).filter((action) => action.playerID === playerId);
		const takeover = actions.findIndex(isAiTakeoverAction);
		const window = takeover >= 0 ? actions.slice(0, takeover + 1) : actions;
		return window.filter((action) => !isCpmExcludedAction(action)) as ReplayAction[];
	}

	function playerCpmForReplay(data: ReplayData, playerId: number | null): string {
		if (playerId == null) {
			return '0';
		}

		const replay = data as unknown as ParsedReplay;
		const precomputed = replay.cpmByPlayerId?.[String(playerId)];
		if (precomputed != null) {
			return precomputed;
		}

		if (!(replay.duration > 0)) {
			return '0';
		}

		const playerActions = (replay.actions ?? []).filter((action) => action.playerID === playerId);
		const takeoverIndex = playerActions.findIndex(isAiTakeoverAction);
		const window =
			takeoverIndex >= 0 ? playerActions.slice(0, takeoverIndex) : playerActions;

		const keys = new Set<string>();
		for (const action of window) {
			if (isCpmExcludedAction(action)) {
				continue;
			}

			keys.add(`${action.tick}|${action.commandID ?? 0}|${action.objectID ?? 0}`);
		}

		if (keys.size === 0) {
			return '0';
		}

		const minutes =
			takeoverIndex >= 0
				? Math.max(playerActions[takeoverIndex].tick / 8 / 60, 1 / 60)
				: Math.max(replay.duration / 60, 1 / 60);
		return String(Math.round(keys.size / minutes));
	}

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
		linkedLabels = {};
		uploadError = null;
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

		const previous = parsed.players[index]?.steamId
			? String(parsed.players[index]?.steamId)
			: null;
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

		try {
			const players = await unwrapApi(api.players.search(q, { requireMatches: true }));
			if (players.length > 0) {
				return players.map((player) => ({
					value: player.steamId,
					label: player.alias || player.steamId,
					avatarUrl: player.avatarUrl || null,
					country: player.country ?? null,
					profileId: player.profileId || null
				}));
			}
		} catch {
			// fall through to raw steam id
		}

		if (isValidSteamId(q)) {
			return [{ value: q, label: q, avatarUrl: null, country: null, profileId: null }];
		}

		return [];
	}

	async function onFilePicked(next: File | null) {
		parseError = null;
		uploadError = null;
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
			const parsedReplay = replay as ParsedReplay;
			if (!Array.isArray(parsedReplay.players) || parsedReplay.players.length === 0) {
				throw new Error('empty-players');
			}

			const ranked = parsedReplay.matchType?.toLowerCase().includes('automatch') ?? false;
			const nextTitle =
				parsedReplay.replayName?.trim() ||
				normalizeMapName(
					(parsedReplay.mapFileName || parsedReplay.mapName || next.name)
						.split(/[/\\]/)
						.pop() ?? next.name
				) ||
				'-';
			isRanked = ranked;
			title = nextTitle;
			linkedLabels = {};
			parseId = nextParseId;
			actionsLoaded = false;
			parsed = {
				...parsedReplay,
				actions: parsedReplay.actions ?? []
			};
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
		uploadError = null;
		parsePending = true;
		try {
			const match = await app.database.matches.getById(lobbyId);
			const ownerId =
				typeof match.user === 'string' ? match.user : String(match.user?.id || '');
			if (!ownerId || ownerId !== app.account.userId) {
				parseError = t('You can only publish your own matches.');
				return;
			}

			const linked =
				typeof match.memberReplay === 'string'
					? match.memberReplay
					: String((match.memberReplay as { id?: string } | undefined)?.id || '');
			if (linked) {
				await goto(`/replays/${linked}`);
				return;
			}

			if (!(match.hasReplay || match.replay)) {
				parseError = t('This match has no replay file.');
				return;
			}

			const detail = await app.database.replays.getDetail(lobbyId);
			const name = String(match.replay || `${lobbyId}.rec`);
			const nextFile = new File([detail.bytes], name, {
				type: 'application/octet-stream'
			});
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

		if (fromMatchId) {
			busy = true;
			uploadError = null;
			try {
				const published = await app.database.replays.publishFromMatch(fromMatchId, {
					title: title.trim() || '-',
					description: description.trim(),
					durationInSeconds: parsed.duration || 0,
					players: parsed.players
				});
				app.toast.success(t('Replay published to Member replays.'));
				await goto(`/replays/${published.id}`);
			} catch (err) {
				uploadError = err instanceof Error ? err.message : t('Failed to publish replay.');
				busy = false;
			}
			return;
		}

		if (!file) {
			return;
		}

		const mapFilename = parsed.mapFileName || parsed.mapName || 'Unknown';
		const mapNameRaw = parsed.mapName || 'Unknown';
		const mapName = /^\$\d+$/.test(mapNameRaw)
			? mapFilename.split(/[/\\]/).pop() || mapNameRaw
			: mapNameRaw;

		busy = true;
		uploadError = null;
		try {
			const uploaded = await unwrapApi(
				api.replays.uploadMember({
					file,
					filename: file.name,
					title: title.trim() || '-',
					description: description.trim(),
					mapName,
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
				})
			);
			app.toast.success(t('Replay uploaded to Member replays.'));
			await goto(`/replays/${uploaded.id}`);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : t('Failed to upload replay.');
			busy = false;
		}
	}

	$effect(() => {
		const lobbyId = fromMatchId;
		if (!lobbyId) {
			return;
		}

		let cancelled = false;
		void loadFromMatch(lobbyId).then(() => {
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

<SetCrumbs items={[{ label: fromMatchId ? t('Publish replay') : t('Upload replay') }]} />

<div class={cn('border-secondary-800 border-b border-dashed', hasReplay && !parseError && 'hidden')}>
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
				busy={busy || parsePending}
				label={t('Replay file')}
				dropLabel={t('Drop a .rec file here')}
				browseLabel={t('or click to browse')}
				changeFileLabel={t('Change file')}
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
	{@const parsedReplay = parsed}
	<DetailHeader
		mapName={mapLabel}
		map={match.map}
		downloadCount={0}
		listHref={memberReplaysHref}
		{resolveMapSrc}
		showDownload={false}
		showNav={false}
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
					<Button type="button" loading={busy} disabled={!canPublish} onclick={() => void onPublish()}>
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
			{searchMentions}
			excludeUserId={app.account.userId}
			{...composerLabels}
		/>
	</Form.Group>

	<PlayerSteamLinks
		players={steamLinkPlayers}
		onLink={linkPlayerSteam}
		onSearchPlayers={searchPlayers}
		{resolveFactionFlag}
		raceFromFaction={raceFromReplayFaction}
		{resolveAvatarUrl}
		{flagImageUrl}
		{resolvePlayerHref}
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
				livePlayers={ratingPreview.current?.livePlayers ?? []}
				playerHref={resolveOverviewPlayerHref}
				{flagImageUrl}
				{getCountryDisplayName}
				{resolveFactionFlag}
				{raceFromReplayFaction}
				{doctrineBannerUrl}
				playerCpm={playerCpmForReplay}
				getRankImage={getRankImage}
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
						raceFromFaction={raceFromReplayFaction}
					/>
				{/if}
			{/if}
		{/snippet}
	</Tabs>
{/if}
