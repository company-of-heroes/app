<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { page } from '$app/state';
	import * as List from '$lib/components/ui/list';
	import { useReplay } from '.';
	import { cn } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import MapImage from '@company-of-heroes/ui/map-image';
	import dayjs from '$lib/dayjs';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import { detailMetaGrid, interactive } from '$lib/components/ui/variants';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import type { LobbiesResponse, ReplaysRecord, UsersResponse } from '$core/pocketbase/types';
	import { account } from '$core/account';
	import { resource } from 'runed';
	import { useI18n } from '$lib/i18n';
	import { StaffDebug } from '@company-of-heroes/ui/staff-debug';

	type LobbyWithUser = LobbiesResponse<
		unknown,
		unknown,
		unknown,
		{
			user?: UsersResponse;
		}
	>;

	type Props = {
		canRename?: boolean;
		replayId?: string | null;
		replayRecord?: ReplaysRecord | null;
		onRenamed?: (payload: { bytes: Uint8Array; title: string }) => void;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		canRename = false,
		replayId = null,
		replayRecord = null,
		onRenamed,
		...restProps
	}: Props = $props();
	const { t } = useI18n();
	let replay = $derived(useReplay());
	let isRanked = $derived(replay.matchType === 'automatch');
	const mapKey = $derived(replay.mapFileName.split(/[/\\]/).pop());
	const mapLabel = $derived(getString(replay.mapName));
	const gameDate = $derived(
		replay.gameDate ? dayjs(replay.gameDate).format('DD MMM YYYY, HH:mm') : '—'
	);
	const duration = $derived(
		dayjs
			.duration(replay.duration, 'seconds')
			.format(replay.duration < 3600 ? `m [${t('min')}]` : `H [${t('hr')}] m [${t('min')}]`)
	);

	let editing = $state(false);
	let draftName = $state('');
	let saving = $state(false);

	const formatDate = (value?: string | null) =>
		value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '—';

	const isStaff = $derived(app.account.isStaff);

	const escapeFilter = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

	async function findLobbyByReplayFile(
		file: string,
		filename: string
	): Promise<LobbyWithUser | null> {
		for (const candidate of [file, filename]) {
			if (!candidate) {
				continue;
			}

			const escaped = escapeFilter(candidate);
			try {
				const result = await pocketbase.collection('lobbies').getList<LobbyWithUser>(1, 1, {
					filter: `replay = "${escaped}"`,
					expand: 'user',
					fetch
				});
				if (result.items.length > 0) {
					return result.items[0];
				}
			} catch (error) {
				console.warn('[REPLAY]: lobby lookup by replay file failed:', error);
			}
		}

		return null;
	}

	const staffLobby = resource(
		() => {
			if (!isStaff) {
				return null;
			}

			if (replayRecord) {
				return {
					kind: 'byReplay' as const,
					file: replayRecord.file,
					filename: replayRecord.filename
				};
			}

			const id = page.params.replayId;
			if (!id) {
				return null;
			}

			return { kind: 'byId' as const, id };
		},
		async (key) => {
			if (!key) {
				return null;
			}

			try {
				if (key.kind === 'byId') {
					return await app.database.matches.getById(key.id);
				}

				return await findLobbyByReplayFile(key.file, key.filename);
			} catch (error) {
				console.warn('[REPLAY]: staff lobby lookup failed:', error);
				return null;
			}
		}
	);

	const lobbyId = $derived(
		staffLobby.current?.id ?? (!replayRecord ? (page.params.replayId ?? null) : null)
	);
	const sessionId = $derived(staffLobby.current?.sessionId ?? null);
	const lobbyOwner = $derived.by(() => {
		const lobby = staffLobby.current;
		if (!lobby) {
			return null;
		}

		const expanded =
			'expand' in lobby && lobby.expand && typeof lobby.expand === 'object'
				? (lobby.expand as { user?: UsersResponse }).user
				: undefined;
		const user =
			expanded ??
			(typeof lobby.user === 'object' && lobby.user !== null
				? (lobby.user as UsersResponse)
				: null);
		if (!user) {
			return typeof lobby.user === 'string' ? lobby.user : null;
		}

		return user.name || user.email || user.id;
	});

	function startEdit() {
		draftName = replay.replayName || '';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		draftName = '';
	}

	async function saveName() {
		if (!replayId || saving) {
			return;
		}

		const next = draftName.trim();
		if (next === (replay.replayName || '').trim()) {
			cancelEdit();
			return;
		}

		saving = true;
		try {
			const result = await app.database.replays.rename(replayId, next);
			onRenamed?.(result);
			app.toast.success(t('Replay name updated.'));
			editing = false;
		} catch (error) {
			app.toast.error(
				t('Failed to rename replay: {message}', { message: (error as Error).message })
			);
		} finally {
			saving = false;
		}
	}
</script>

<div
	{...restProps}
	class={cn(
		'border-secondary-800 grid grid-cols-1 border-b sm:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]',
		restProps.class
	)}
>
	<div class="border-secondary-800 aspect-square self-start sm:border-r">
		<MapImage map={mapKey} alt={mapLabel} flush />
	</div>

	<div class="min-w-0">
		<div class="px-6 py-4">
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<span class="font-heading block min-w-0 truncate text-3xl font-bold">{mapLabel}</span>
			</div>

			<div class={detailMetaGrid}>
				<List.Title>{t('Replay name')}</List.Title>
				<List.Value>
					{#if canRename && editing}
						<form
							class="flex min-w-0 flex-wrap items-center gap-2"
							onsubmit={(event) => {
								event.preventDefault();
								void saveName();
							}}
						>
							<Input
								class="min-w-0 flex-1"
								bind:value={draftName}
								disabled={saving}
								placeholder={t('Replay name')}
								aria-label={t('Replay name')}
							/>
							<Button type="submit" size="sm" loading={saving}>{t('Save')}</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								disabled={saving}
								onclick={cancelEdit}
							>
								{t('Cancel')}
							</Button>
						</form>
					{:else if canRename}
						<button
							type="button"
							class={cn(interactive, 'group flex max-w-full items-center gap-2 text-left')}
							onclick={startEdit}
						>
							<span class="truncate">{replay.replayName || '—'}</span>
							<PencilSimpleIcon
								class="text-secondary-500 group-hover:text-secondary-300 size-4 shrink-0"
								weight="bold"
							/>
						</button>
					{:else}
						{replay.replayName || '—'}
					{/if}
				</List.Value>

				<List.Title>{t('Date')}</List.Title>
				<List.Value>{gameDate}</List.Value>
				{#if isRanked}
					<List.Title>{t('Duration')}</List.Title>
					<List.Value>{duration}</List.Value>
				{:else}
					<List.Title>{t('Lobby title')}</List.Title>
					<List.Value>{replay.matchType}</List.Value>
				{/if}

				<List.Title>{t('Game mode')}</List.Title>
				<List.Value class="flex items-center gap-2">
					{#if isRanked}
						<RankingIcon class="text-primary" /> {t('Ranked')}
					{:else}
						{t('Custom game')}
					{/if}
				</List.Value>
				{#if isRanked}
					<List.Title>{t('Players')}</List.Title>
					<List.Value>{replay.players.length}</List.Value>
				{:else}
					<List.Title>{t('Duration')}</List.Title>
					<List.Value>{duration}</List.Value>
				{/if}

				{#if replay.vpGame}
					<List.Title>{t('Victory points')}</List.Title>
					<List.Value>{replay.vpCount}</List.Value>
				{/if}
				{#if !isRanked}
					<List.Title>{t('Players')}</List.Title>
					<List.Value>{replay.players.length}</List.Value>
				{/if}

				<List.Title>{t('ID')}</List.Title>
				<List.Value class="tabular-nums">{page.params.replayId}</List.Value>
			</div>

			{#if replayRecord?.description?.trim()}
				<div class="mt-4">
					<h2 class="font-heading text-lg font-bold text-white">{t('Description')}</h2>
					<p class="text-secondary-300 mt-2 text-sm whitespace-pre-wrap">
						{replayRecord.description.trim()}
					</p>
				</div>
			{/if}
		</div>

		{#if isStaff}
			<div class="px-6">
				<StaffDebug>
					<div class={detailMetaGrid}>
						<List.Title>{t('Replay ID')}</List.Title>
						<List.Value class="tabular-nums">{page.params.replayId}</List.Value>
						{#if replayRecord}
							<List.Title>{t('Replay created')}</List.Title>
							<List.Value>{formatDate(replayRecord.createdAt)}</List.Value>
							<List.Title>{t('Replay updated')}</List.Title>
							<List.Value>{formatDate(replayRecord.updatedAt)}</List.Value>
						{/if}

						<List.Title>{t('Match ID')}</List.Title>
						<List.Value class="tabular-nums">
							{#if lobbyId}
								<a
									href="/history/{lobbyId}"
									class={cn(interactive, 'hover:text-primary underline')}
								>
									{lobbyId}
								</a>
							{:else}
								—
							{/if}
						</List.Value>
						<List.Title>{t('Session ID')}</List.Title>
						<List.Value class="tabular-nums">{sessionId ?? '—'}</List.Value>

						{#if staffLobby.current}
							<List.Title>{t('Match created')}</List.Title>
							<List.Value>{formatDate(staffLobby.current.createdAt)}</List.Value>
							<List.Title>{t('Match updated')}</List.Title>
							<List.Value>{formatDate(staffLobby.current.updatedAt)}</List.Value>
							<List.Title>{t('Owner')}</List.Title>
							<List.Value>{lobbyOwner ?? '—'}</List.Value>
						{/if}
					</div>
				</StaffDebug>
			</div>
		{/if}
	</div>
</div>
