<script lang="ts">
	import type { Snippet } from 'svelte';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import CaptureImage from '$lib/components/anti-cheat/capture-image.svelte';
	import { interactive, tabTrigger, type SemanticVariant } from '$lib/components/ui/variants';
	import { app } from '$core/app/context';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import {
		deleteCheaterLabelsForUser,
		labelCheaterAccounts,
		listCapturesForUserSession,
		type CaptureRecord
	} from '$core/pocketbase/anti-cheat';
	import {
		AntiCheatReportsStatusOptions,
		type AntiCheatReportsResponse,
		type UsersResponse
	} from '$core/pocketbase/types';
	import { ClientResponseError } from 'pocketbase';
	import { resource } from 'runed';
	import { relic } from '$lib/relic';
	import { cn } from '$lib/utils';
	import dayjs from '$lib/dayjs';
	import { useI18n } from '$lib/i18n';
	import { PlayerProfileLink } from '@company-of-heroes/ui/player';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';

	const { t } = useI18n();

	type StatusFilter = 'all' | AntiCheatReportsStatusOptions;
	type ReportUser = UsersResponse<Record<string, unknown>, string[]>;
	type ReportRow = AntiCheatReportsResponse<{
		accused?: ReportUser;
		reporter?: ReportUser;
	}>;

	const statusFilters: { id: StatusFilter; label: string }[] = [
		{ id: 'all', label: t('All') },
		{ id: AntiCheatReportsStatusOptions.pending, label: t('Pending') },
		{ id: AntiCheatReportsStatusOptions.confirmed, label: t('Confirmed') },
		{ id: AntiCheatReportsStatusOptions.dismissed, label: t('Dismissed') }
	];

	let statusFilter = $state<StatusFilter>('pending');
	let expandedOverride = $state<string | null | undefined>(undefined);
	let updatingId = $state<string | null>(null);

	const loadReports = async (status: StatusFilter): Promise<ReportRow[]> => {
		try {
			const response = await pocketbase.collection('anti_cheat_reports').getList<ReportRow>(1, 50, {
				...(status === 'all' ? {} : { filter: `status = "${status}"` }),
				sort: '-created',
				expand: 'accused,reporter',
				fetch
			});
			return response.items;
		} catch (error) {
			console.error('[ADMIN]: reports load failed:', error);
			app.toast.error(t('Could not load flagged players.'));
			return [];
		}
	};

	const reports = resource(
		() => (app.account.isStaff ? statusFilter : null),
		async (status) => (status ? loadReports(status) : [])
	);

	const rows = $derived(reports.current ?? []);
	const expandedId = $derived.by(() => {
		if (expandedOverride === undefined) return rows[0]?.id ?? null;
		if (expandedOverride === null) return null;
		if (rows.some((report) => report.id === expandedOverride)) return expandedOverride;
		return rows[0]?.id ?? null;
	});
	const expandedReport = $derived(rows.find((report) => report.id === expandedId) ?? null);

	const aliasBySteamId = resource(
		() => {
			const ids = rows.flatMap((report) => [
				report.accused_steam_id,
				...steamIdsOf(report.expand?.accused),
				...steamIdsOf(report.expand?.reporter)
			]);
			return [...new Set(ids.filter(Boolean))].join(',');
		},
		async (key) => {
			const ids = key ? key.split(',') : [];
			const entries = await Promise.all(
				ids.map(async (id) => {
					try {
						const profile = await relic.getProfileBySteamId(id);
						return profile?.alias ? ([id, profile.alias] as const) : null;
					} catch {
						return null;
					}
				})
			);
			return Object.fromEntries(entries.filter((entry) => entry !== null));
		}
	);

	const captures = resource(
		() => (expandedReport ? `${expandedReport.accused}:${expandedReport.session_id}` : null),
		async () => {
			if (!expandedReport) return [] as CaptureRecord[];
			try {
				return await listCapturesForUserSession(expandedReport.accused, expandedReport.session_id);
			} catch (error) {
				console.error('[ADMIN]: report captures load failed:', error);
				return [];
			}
		}
	);

	const columns = $derived.by((): ColumnDef<ReportRow>[] => [
		{
			id: 'player',
			header: t('Player'),
			width: 'w-5/24',
			class: 'min-w-0 truncate font-medium'
		},
		{
			id: 'reporter',
			header: t('Reporter'),
			width: 'w-4/24',
			class: 'text-secondary-400 min-w-0 truncate text-sm'
		},
		{
			id: 'date',
			header: t('Date'),
			width: 'w-4/24',
			class: 'text-secondary-400 truncate text-sm'
		},
		{ id: 'status', header: t('Status'), width: 'w-3/24' },
		{ id: 'actions', header: '', width: 'w-4/24', hideSkeleton: true },
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

	const statusLabel = (status: AntiCheatReportsStatusOptions) => {
		if (status === 'pending') return t('Pending');
		if (status === 'confirmed') return t('Confirmed');
		return t('Dismissed');
	};

	const statusVariant = (status: AntiCheatReportsStatusOptions): SemanticVariant => {
		if (status === 'confirmed') return 'destructive';
		if (status === 'pending') return 'warning';
		return 'default';
	};

	function steamIdsOf(user: ReportUser | undefined): string[] {
		if (!Array.isArray(user?.steamIds)) return [];
		return user.steamIds.map((id) => String(id)).filter(Boolean);
	}

	function relicAlias(steamId: string | undefined): string | undefined {
		if (!steamId) return undefined;
		return aliasBySteamId.current?.[steamId];
	}

	const accusedSteamId = (report: ReportRow) =>
		report.accused_steam_id || steamIdsOf(report.expand?.accused)[0] || '';

	const accusedLabel = (report: ReportRow) =>
		relicAlias(accusedSteamId(report)) || accusedSteamId(report) || report.accused;

	const reporterLabel = (report: ReportRow) => {
		const steamId = steamIdsOf(report.expand?.reporter)[0];
		return relicAlias(steamId) || steamId || report.reporter;
	};

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

	function toggleExpanded(id: string) {
		expandedOverride = expandedId === id ? null : id;
	}

	const reloadReports = async () => {
		reports.mutate(await loadReports(statusFilter));
	};

	const setStatus = async (report: ReportRow, status: AntiCheatReportsStatusOptions) => {
		updatingId = report.id;
		try {
			await pocketbase.collection('anti_cheat_reports').update(report.id, { status }, { fetch });
			await reloadReports();
		} catch (error) {
			console.error('[ADMIN]: report update failed:', error);
			app.toast.error(t('Could not update report.'));
		} finally {
			updatingId = null;
		}
	};

	const markCheater = async (report: ReportRow) => {
		const steamIds = [
			...new Set([report.accused_steam_id, ...steamIdsOf(report.expand?.accused)].filter(Boolean))
		];
		if (steamIds.length === 0) {
			app.toast.error(t('This report has no Steam ID.'));
			return;
		}

		const confirmed = await confirm(
			t('Mark this player as a cheater? They will get a cheater label, not a ban.'),
			{ okLabel: t('Mark as cheater'), cancelLabel: t('Cancel'), kind: 'warning' }
		);
		if (!confirmed) return;

		updatingId = report.id;
		try {
			await labelCheaterAccounts({
				userId: report.accused,
				steamIds,
				labeledBy: app.account.userId
			});
			await pocketbase
				.collection('anti_cheat_reports')
				.update(report.id, { status: AntiCheatReportsStatusOptions.confirmed }, { fetch });
			app.toast.success(t('Player marked as a cheater.'));
			await reloadReports();
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 400) {
				await pocketbase
					.collection('anti_cheat_reports')
					.update(report.id, { status: AntiCheatReportsStatusOptions.confirmed }, { fetch });
				await reloadReports();
			} else {
				console.error('[ADMIN]: mark cheater failed:', error);
				app.toast.error(t('Could not mark player as a cheater.'));
			}
		} finally {
			updatingId = null;
		}
	};

	const removeCheater = async (report: ReportRow) => {
		if (!report.accused) return;
		const confirmed = await confirm(t('Remove the cheater label from this player?'), {
			okLabel: t('Remove cheater label'),
			cancelLabel: t('Cancel'),
			kind: 'warning'
		});
		if (!confirmed) return;

		updatingId = report.id;
		try {
			await deleteCheaterLabelsForUser(report.accused);
			app.toast.success(t('Cheater label removed.'));
		} catch (error) {
			console.error('[ADMIN]: remove cheater failed:', error);
			app.toast.error(t('Could not remove cheater label.'));
		} finally {
			updatingId = null;
		}
	};

	function openCapture(capture: CaptureRecord) {
		app.modal.create({
			component: CaptureImage,
			title: t('Screenshot'),
			description: dayjs(capture.captured_at || capture.created).format('D MMM YYYY HH:mm'),
			props: {
				capture,
				class: 'w-full max-h-[calc(100vh-9rem)] rounded-md object-contain p-4'
			},
			size: 'full'
		});
		app.modal.open();
	}
</script>

{#snippet cell_player({ row }: { row: ReportRow })}
	{#if accusedSteamId(row)}
		<PlayerProfileLink
			href="/players/{accusedSteamId(row)}"
			playerId={accusedSteamId(row)}
			class={cn(interactive, 'text-secondary-300 hover:text-primary min-w-0 truncate font-medium')}
		>
			{accusedLabel(row)}
		</PlayerProfileLink>
	{:else}
		<span class="min-w-0 truncate">{accusedLabel(row)}</span>
	{/if}
{/snippet}
{#snippet cell_reporter({ row }: { row: ReportRow })}
	{reporterLabel(row)}
{/snippet}
{#snippet cell_date({ row }: { row: ReportRow })}
	{formatDate(row.created)}
{/snippet}
{#snippet cell_status({ row }: { row: ReportRow })}
	<Badge variant={statusVariant(row.status)} class="px-2 py-0.5">
		{statusLabel(row.status)}
	</Badge>
{/snippet}
{#snippet cell_actions({ row }: { row: ReportRow })}
	{#if row.lobby}
		<Button href="/history/{row.lobby}" variant="secondary" size="sm" class="h-7 px-2.5 text-xs">
			{t('Open match')}
		</Button>
	{/if}
{/snippet}
{#snippet cell_expand({ row }: { row: ReportRow })}
	<CaretDownIcon
		class={cn(
			'pointer-events-none size-4 transition-transform',
			expandedId === row.id && 'rotate-180'
		)}
	/>
{/snippet}
{#snippet rowWrapper({ row, children }: { row: ReportRow; children: Snippet })}
	{@render children()}
	{#if expandedId === row.id}
		<tr class="border-secondary-800 border-b">
			<td colspan={columns.length} class="p-0">
				<div class="border-secondary-800 divide-secondary-800 divide-y border-t">
					{#if row.session_id || row.accused_steam_id}
						<p class="text-secondary-500 px-4 py-2.5 text-xs">
							{#if row.session_id}{t('Session')} {row.session_id}{/if}
							{#if row.session_id && row.accused_steam_id}
								·
							{/if}
							{#if row.accused_steam_id}<span class="tabular-nums">{row.accused_steam_id}</span
								>{/if}
						</p>
					{/if}
					{#if captures.loading}
						<p class="text-secondary-500 px-4 py-3 text-sm">{t('Loading screenshots...')}</p>
					{:else if (captures.current?.length ?? 0) > 0}
						<div class="grid grid-cols-3 gap-px sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
							{#each captures.current ?? [] as capture (capture.id)}
								<button
									type="button"
									class={cn(
										interactive,
										'relative aspect-video w-full overflow-clip opacity-30 transition-opacity hover:opacity-100 focus-visible:opacity-100'
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
					{:else}
						<p class="text-secondary-500 px-4 py-3 text-sm">
							{t('No screenshots for this report.')}
						</p>
					{/if}
					<div class="flex flex-wrap gap-2 px-4 py-3">
						<Button
							type="button"
							size="sm"
							variant="destructive"
							loading={updatingId === row.id}
							onclick={() => void markCheater(row)}
						>
							{t('Mark as cheater')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="success"
							loading={updatingId === row.id}
							onclick={() => void setStatus(row, 'dismissed')}
						>
							{t('Dismiss')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							loading={updatingId === row.id}
							onclick={() => void removeCheater(row)}
						>
							{t('Remove cheater label')}
						</Button>
					</div>
				</div>
			</td>
		</tr>
	{/if}
{/snippet}

<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
	{#each statusFilters as filter (filter.id)}
		<button
			type="button"
			class={tabTrigger}
			data-state={statusFilter === filter.id ? 'active' : undefined}
			onclick={() => {
				statusFilter = filter.id;
				expandedOverride = undefined;
			}}
		>
			{filter.label}
		</button>
	{/each}
</div>

{#if !reports.loading && rows.length === 0}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('No flagged players yet.')}</p>
{:else}
	<DataTable
		data={rows}
		{columns}
		rowKey={(report) => report.id}
		onRowClick={(report) => toggleExpanded(report.id)}
		isRowExpanded={(report) => expandedId === report.id}
		{rowWrapper}
		loading={reports.loading && rows.length === 0}
		skeletonRows={4}
		striped={false}
		empty={t('No flagged players yet.')}
		cells={{
			player: cell_player,
			reporter: cell_reporter,
			date: cell_date,
			status: cell_status,
			actions: cell_actions,
			expand: cell_expand
		}}
	/>
{/if}
