<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { Snippet } from 'svelte';
	import CaptureImage from '$lib/components/anti-cheat/capture-image.svelte';
	import CheaterAlert from '$lib/components/player/cheater-alert.svelte';
	import PlayerLikeCount from '$lib/components/player/player-like-count.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { resource } from 'runed';
	import { account } from '$core/account';
	import { app } from '$core/app/context';
	import {
		createPlayerFlag,
		listCapturesBySession,
		listOwnReportForMatch,
		type CaptureRecord
	} from '$core/pocketbase/anti-cheat';
	import type { UsersResponse } from '$core/pocketbase/types';
	import { getPlayerAlias, getPlayerProfileId } from '$lib/components/widgets/dashboard-utils';
	import { interactive } from '$lib/components/ui/variants';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';
	import { PlayerProfileLink } from '@company-of-heroes/ui/player';
	import { ClientResponseError } from 'pocketbase';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';

	type ResultPlayer = {
		steamId?: string | null;
		name?: string | null;
		alias?: string | null;
		profile_id?: number | null;
	};

	type Props = {
		sessionId: number;
		lobbyId?: string;
		players?: LobbyPlayer[];
		resultPlayers?: ResultPlayer[];
		cheaters?: Set<string>;
	};

	type CaptureGroup = {
		key: string;
		userId: string;
		steamId: string;
		alias: string;
		profileId?: number;
		capturedAt: string;
		captures: CaptureRecord[];
	};

	let {
		sessionId,
		lobbyId,
		players = [],
		resultPlayers = [],
		cheaters = new Set()
	}: Props = $props();
	const { t } = useI18n();

	const captures = resource(
		() => sessionId,
		(id) => listCapturesBySession(id)
	);
	const ownReports = resource(
		() => (account.isAuthenticated ? `${account.userId}:${sessionId}` : null),
		() => listOwnReportForMatch(account.userId, sessionId)
	);

	let expandedId = $state<string | null>(null);
	let flaggingKey = $state<string | null>(null);
	let extraFlagged = $state<string[]>([]);

	function captureUser(capture: CaptureRecord): UsersResponse | null {
		return (capture.expand as { user?: UsersResponse } | undefined)?.user ?? null;
	}

	function steamIdsOf(groupCaptures: CaptureRecord[]): string[] {
		const ids: string[] = [];
		for (const capture of groupCaptures) {
			if (capture.steam_id && !ids.includes(capture.steam_id)) {
				ids.push(capture.steam_id);
			}
			const userSteamIds = captureUser(capture)?.steamIds;
			for (const steamId of Array.isArray(userSteamIds) ? userSteamIds : []) {
				const id = String(steamId);
				if (id && !ids.includes(id)) ids.push(id);
			}
		}
		return ids;
	}

	function resultSteamId(player: ResultPlayer): string | null {
		if (player.steamId) return player.steamId;
		if (player.name?.startsWith('/steam/')) return player.name.slice('/steam/'.length);
		return null;
	}

	function resolveGroup(groupCaptures: CaptureRecord[]): Omit<CaptureGroup, 'key' | 'captures'> {
		const userId = groupCaptures[0]?.user ?? '';
		const steamIds = steamIdsOf(groupCaptures);
		const steamId = steamIds[0] ?? '';
		const capturedAt = groupCaptures[0]?.captured_at || groupCaptures[0]?.created || '';

		const lobbyPlayer = players.find(
			(player) => player.steamId && steamIds.includes(player.steamId)
		);
		if (lobbyPlayer) {
			return {
				userId,
				steamId: lobbyPlayer.steamId || steamId,
				alias: lobbyPlayer.profile?.alias || getPlayerAlias(lobbyPlayer),
				profileId: getPlayerProfileId(lobbyPlayer),
				capturedAt
			};
		}

		const resultPlayer = resultPlayers.find((player) => {
			const id = resultSteamId(player);
			return !!id && steamIds.includes(id);
		});
		if (resultPlayer?.alias) {
			return {
				userId,
				steamId: resultSteamId(resultPlayer) || steamId,
				alias: resultPlayer.alias,
				profileId:
					resultPlayer.profile_id && resultPlayer.profile_id > 0
						? resultPlayer.profile_id
						: undefined,
				capturedAt
			};
		}

		return { userId, steamId, alias: t('Player'), capturedAt };
	}

	const groups = $derived.by((): CaptureGroup[] => {
		const byUser: Record<string, CaptureRecord[]> = {};
		for (const capture of captures.current ?? []) {
			const key = capture.user || capture.steam_id || capture.id;
			(byUser[key] ??= []).push(capture);
		}

		return Object.entries(byUser).map(([key, groupCaptures]) => ({
			key,
			...resolveGroup(groupCaptures),
			captures: groupCaptures
		}));
	});

	const flaggedAccused = $derived(
		new Set([...(ownReports.current ?? []).map((report) => report.accused), ...extraFlagged])
	);
	const columns = $derived.by((): ColumnDef<CaptureGroup>[] => [
		{
			id: 'player',
			header: t('Player'),
			width: 'w-8/24',
			class: 'min-w-0 truncate font-medium'
		},
		{
			id: 'screenshots',
			header: t('Screenshots'),
			width: 'w-4/24',
			class: 'text-secondary-400 truncate text-sm'
		},
		{
			id: 'date',
			header: t('Date'),
			width: 'w-6/24',
			class: 'text-secondary-400 truncate text-sm'
		},
		{ id: 'actions', header: '', width: 'w-5/24', hideSkeleton: true },
		{
			id: 'expand',
			header: '',
			width: 'w-1/24',
			headerCellClass: 'p-0',
			cellClass: () => 'p-0',
			class: 'flex w-full justify-center',
			hideSkeleton: true
		}
	]);

	const isSelf = (group: CaptureGroup) => {
		if (!account.isAuthenticated) return true;
		if (group.userId && group.userId === account.userId) return true;
		return !!group.steamId && (account.user.steamIds ?? []).includes(group.steamId);
	};

	const canFlag = (group: CaptureGroup) => {
		if (!account.isAuthenticated || isSelf(group) || !group.userId) return false;
		return !flaggedAccused.has(group.userId);
	};

	function toggleExpanded(key: string) {
		expandedId = expandedId === key ? null : key;
	}

	function formatDate(value: string) {
		if (!value) return '';
		return new Date(value).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const flagPlayer = async (group: CaptureGroup) => {
		if (!canFlag(group)) return;
		const confirmed = await confirm(
			t('Flag {name} as suspicious for this match? Staff will review the screenshots.', {
				name: group.alias
			}),
			{ okLabel: t('Flag player'), cancelLabel: t('Cancel'), kind: 'warning' }
		);
		if (!confirmed) return;

		flaggingKey = group.key;
		try {
			await createPlayerFlag({
				reporter: account.userId,
				accused: group.userId,
				sessionId,
				lobbyId,
				accusedSteamId: group.steamId
			});
			extraFlagged = [...extraFlagged, group.userId];
			app.toast.success(t('Player flagged for review.'));
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 400) {
				app.toast.error(t('You already flagged this player for this match.'));
			} else {
				app.toast.error(t('Could not flag player.'));
			}
		} finally {
			flaggingKey = null;
		}
	};

	function openCapture(capture: CaptureRecord) {
		app.modal.create({
			component: CaptureImage,
			title: t('Screenshot'),
			description: formatDate(capture.captured_at || capture.created),
			props: {
				capture,
				class: 'w-full max-h-[calc(100vh-9rem)] rounded-md object-contain p-4'
			},
			size: 'full'
		});
		app.modal.open();
	}
</script>

{#snippet cell_player({ row }: { row: CaptureGroup })}
	<span class="flex min-w-0 items-center gap-2">
		<PlayerLikeCount steamId={row.steamId} class="shrink-0" />
		{#if row.profileId}
			<PlayerProfileLink
				href="/players/{row.profileId}"
				playerId={String(row.profileId)}
				class={cn(interactive, 'text-secondary-300 hover:text-primary min-w-0 truncate font-medium')}
			>
				{row.alias}
			</PlayerProfileLink>
		{:else}
			<span class="min-w-0 truncate">{row.alias}</span>
		{/if}
		{#if row.steamId && cheaters.has(row.steamId)}
			<CheaterAlert compact />
		{/if}
	</span>
{/snippet}
{#snippet cell_screenshots({ row }: { row: CaptureGroup })}
	{row.captures.length}
	{row.captures.length === 1 ? t('screenshot') : t('screenshots')}
{/snippet}
{#snippet cell_date({ row }: { row: CaptureGroup })}
	{formatDate(row.capturedAt)}
{/snippet}
{#snippet cell_actions({ row }: { row: CaptureGroup })}
	{#if canFlag(row)}
		<Button
			type="button"
			size="sm"
			variant="destructive"
			class="h-7 px-2.5 text-xs"
			loading={flaggingKey === row.key}
			onclick={() => void flagPlayer(row)}
		>
			{t('Flag player')}
		</Button>
	{:else if flaggedAccused.has(row.userId)}
		<span class="text-secondary-500 text-sm">{t('Flagged')}</span>
	{/if}
{/snippet}
{#snippet cell_expand({ row }: { row: CaptureGroup })}
	<CaretDownIcon
		class={cn(
			'pointer-events-none size-4 transition-transform',
			expandedId === row.key && 'rotate-180'
		)}
	/>
{/snippet}
{#snippet rowWrapper({ row, children }: { row: CaptureGroup; children: Snippet })}
	{@render children()}
	{#if expandedId === row.key}
		<tr class="border-secondary-800 border-b">
			<td colspan={columns.length} class="p-0">
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
					{#each row.captures as capture (capture.id)}
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
			</td>
		</tr>
	{/if}
{/snippet}

{#if !captures.loading && groups.length === 0}
	<p class="text-secondary-400 px-4 py-6 text-sm">
		{t('No screenshots for this match. Screenshots only appear when a player used the app.')}
	</p>
{:else}
	<DataTable
		data={groups}
		{columns}
		rowKey={(group) => group.key}
		onRowClick={(group) => toggleExpanded(group.key)}
		isRowExpanded={(group) => expandedId === group.key}
		{rowWrapper}
		loading={captures.loading}
		skeletonRows={2}
		striped={false}
		empty={t('No screenshots for this match. Screenshots only appear when a player used the app.')}
		cells={{
			player: cell_player,
			screenshots: cell_screenshots,
			date: cell_date,
			actions: cell_actions,
			expand: cell_expand
		}}
	/>
{/if}
