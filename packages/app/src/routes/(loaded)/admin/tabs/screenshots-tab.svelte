<script lang="ts">
	import CaptureImage from '$lib/components/anti-cheat/capture-image.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox, Input } from '$lib/components/ui/input';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { interactive } from '$lib/components/ui/variants';
	import { app } from '$core/app/context';
	import {
		deleteCapture,
		deleteCaptures,
		hideCapture,
		listCaptures,
		unhideCapture,
		type CaptureRecord
	} from '$core/pocketbase/anti-cheat';
	import { tooltip } from '$lib/attachments';
	import { cn, normalizeMapName } from '$lib/utils';
	import dayjs from '$lib/dayjs';
	import { PlayerProfileLink } from '@company-of-heroes/ui/player';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';
	import ScreenshotBulkDeleteModal from './screenshot-bulk-delete-modal.svelte';
	import ScreenshotDeleteModal from './screenshot-delete-modal.svelte';
	import ScreenshotHideModal from './screenshot-hide-modal.svelte';

	const overlayActionClass = 'bg-black/55 text-white backdrop-blur-sm hover:bg-black/75';

	const { t } = useI18n();
	const PER_PAGE = 12;
	const SKELETON_KEYS = Array.from({ length: PER_PAGE }, (_, index) => `skeleton-${index}`);

	let queryInput = $state('');
	let appliedQuery = $state('');
	let appliedUserId = $state('');
	let page = $state(1);
	let items = $state.raw<CaptureRecord[]>([]);
	let totalItems = $state(0);
	let loading = $state(false);
	let loadToken = 0;
	let actionId = $state<string | null>(null);
	let selectedIds = $state.raw<string[]>([]);
	let isFiltered = $derived(!!appliedQuery || !!appliedUserId);
	let selectedCount = $derived(selectedIds.length);
	let selectedOnPage = $derived(items.filter((item) => selectedIds.includes(item.id)).length);
	let allPageSelected = $derived(items.length > 0 && selectedOnPage === items.length);

	watch(
		() => [app.account.isStaff, page, appliedQuery, appliedUserId] as const,
		([isStaff]) => {
			if (isStaff) {
				void loadCaptures();
			}
		}
	);

	watch(
		() => [appliedQuery, appliedUserId] as const,
		() => {
			selectedIds = [];
		}
	);

	function captureDate(capture: CaptureRecord) {
		return dayjs(capture.captured_at || capture.created).format('D MMM YYYY HH:mm');
	}

	function captureOwner(capture: CaptureRecord) {
		const user = capture.expand?.user;
		return user?.name || user?.email || '';
	}

	function captureMeta(capture: CaptureRecord) {
		const parts: string[] = [];
		if (capture.map) {
			parts.push(normalizeMapName(capture.map));
		}

		if (capture.session_id) {
			parts.push(`${t('Session')} ${capture.session_id}`);
		}

		return parts.join(' · ');
	}

	function isSelected(id: string) {
		return selectedIds.includes(id);
	}

	function setSelected(id: string, checked: boolean) {
		if (checked) {
			if (selectedIds.includes(id)) {
				return;
			}

			selectedIds = [...selectedIds, id];
			return;
		}

		selectedIds = selectedIds.filter((selectedId) => selectedId !== id);
	}

	function toggleSelectPage() {
		if (allPageSelected) {
			selectedIds = selectedIds.filter((id) => !items.some((item) => item.id === id));
			return;
		}

		const next = [...selectedIds];
		for (const item of items) {
			if (!next.includes(item.id)) {
				next.push(item.id);
			}
		}

		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = [];
	}

	async function loadCaptures() {
		const token = ++loadToken;
		loading = true;
		try {
			const result = await listCaptures({
				page,
				perPage: PER_PAGE,
				query: appliedQuery || undefined,
				userId: appliedUserId || undefined
			});
			if (token !== loadToken) {
				return;
			}

			items = result.items;
			totalItems = result.totalItems;
		} catch (error) {
			if (token !== loadToken) {
				return;
			}

			console.error('[ADMIN]: load screenshots failed:', error);
			app.toast.error(t('Could not load screenshots.'));
			items = [];
			totalItems = 0;
		} finally {
			if (token === loadToken) {
				loading = false;
			}
		}
	}

	function setAppliedQuery(next: string) {
		appliedUserId = '';
		if (next === appliedQuery && page === 1) {
			void loadCaptures();
			return;
		}

		if (page !== 1) {
			appliedQuery = next;
			page = 1;
			return;
		}

		appliedQuery = next;
	}

	function applyFilter() {
		setAppliedQuery(queryInput.trim());
	}

	function filterByQuery(query: string) {
		const next = query.trim();
		queryInput = next;
		setAppliedQuery(next);
	}

	function filterFromCapture(event: MouseEvent, capture: CaptureRecord) {
		event.preventDefault();
		event.stopPropagation();

		const steamId = capture.steam_id?.trim() ?? '';
		if (steamId) {
			filterByQuery(steamId);
			return;
		}

		const owner = captureOwner(capture);
		const userId = capture.user ?? '';
		if (!userId) {
			return;
		}

		queryInput = owner || userId;
		appliedQuery = '';
		if (userId === appliedUserId && page === 1) {
			void loadCaptures();
			return;
		}

		if (page !== 1) {
			appliedUserId = userId;
			page = 1;
			return;
		}

		appliedUserId = userId;
	}

	function clearFilter() {
		queryInput = '';
		if (!appliedQuery && !appliedUserId && page === 1) {
			return;
		}

		if (page !== 1) {
			appliedQuery = '';
			appliedUserId = '';
			page = 1;
			return;
		}

		appliedQuery = '';
		appliedUserId = '';
	}

	function openCapture(capture: CaptureRecord) {
		const owner = captureOwner(capture);
		const meta = [owner || capture.steam_id, captureMeta(capture)].filter(Boolean).join(' · ');
		app.modal.create({
			component: CaptureImage,
			title: t('Screenshot'),
			description: [meta, captureDate(capture)].filter(Boolean).join('\n'),
			props: {
				capture,
				class: 'w-full max-h-[calc(100vh-9rem)] rounded-md object-contain p-4'
			},
			size: 'full'
		});
		app.modal.open();
	}

	function askHide(event: MouseEvent, capture: CaptureRecord) {
		event.preventDefault();
		event.stopPropagation();

		app.modal.create({
			title: t('Hide screenshot'),
			size: 'md',
			component: ScreenshotHideModal,
			props: {
				capture,
				onCancel: () => app.modal.close(),
				onConfirm: async () => {
					try {
						await hideCapture(capture.id);
						app.toast.success(t('Screenshot hidden.'));
						app.modal.close();
						await loadCaptures();
					} catch (error) {
						console.error('[ADMIN]: hide screenshot failed:', error);
						app.toast.error(t('Could not hide screenshot.'));
					}
				}
			}
		});
		app.modal.open();
	}

	async function askUnhide(event: MouseEvent, capture: CaptureRecord) {
		event.preventDefault();
		event.stopPropagation();

		actionId = capture.id;
		try {
			await unhideCapture(capture.id);
			app.toast.success(t('Screenshot visible again.'));
			await loadCaptures();
		} catch (error) {
			console.error('[ADMIN]: unhide screenshot failed:', error);
			app.toast.error(t('Could not show screenshot.'));
		} finally {
			actionId = null;
		}
	}

	function askDelete(event: MouseEvent, capture: CaptureRecord) {
		event.preventDefault();
		event.stopPropagation();

		app.modal.create({
			title: t('Delete screenshot'),
			size: 'md',
			component: ScreenshotDeleteModal,
			props: {
				capture,
				onCancel: () => app.modal.close(),
				onConfirm: async () => {
					try {
						await deleteCapture(capture.id);
						selectedIds = selectedIds.filter((id) => id !== capture.id);
						app.toast.success(t('Screenshot deleted.'));
						app.modal.close();
						if (items.length === 1 && page > 1) {
							page -= 1;
							return;
						}

						await loadCaptures();
					} catch (error) {
						console.error('[ADMIN]: delete screenshot failed:', error);
						app.toast.error(t('Could not delete screenshot.'));
					}
				}
			}
		});
		app.modal.open();
	}

	function askBulkDelete() {
		const ids = [...selectedIds];
		if (ids.length === 0) {
			return;
		}

		app.modal.create({
			title: t('Delete screenshots'),
			size: 'md',
			component: ScreenshotBulkDeleteModal,
			props: {
				count: ids.length,
				onCancel: () => app.modal.close(),
				onConfirm: async () => {
					const { deletedIds, failedIds } = await deleteCaptures(ids);
					const deleted = deletedIds.length;
					const failed = failedIds.length;

					if (failed > 0) {
						console.error('[ADMIN]: bulk delete screenshots failed:', {
							failed,
							failedIds
						});
					}

					selectedIds = selectedIds.filter((id) => !deletedIds.includes(id));

					if (deleted > 0) {
						app.toast.success(t('{count} screenshots deleted.', { count: deleted }));
					}

					if (failed > 0) {
						app.toast.error(t('Could not delete screenshots.'));
					}

					app.modal.close();

					const remainingOnPage = items.filter((item) => !deletedIds.includes(item.id)).length;
					if (remainingOnPage === 0 && page > 1) {
						page -= 1;
						return;
					}

					await loadCaptures();
				}
			}
		});
		app.modal.open();
	}
</script>

{#snippet paginationBar(extraClass = '')}
	{#if totalItems > 0 && !loading}
		<div
			class={cn(
				'border-secondary-800 flex flex-wrap items-center justify-end gap-2 px-4 py-2.5',
				extraClass
			)}
		>
			<p class="text-secondary-500 text-xs tabular-nums">
				{t('{count} screenshots', { count: totalItems })}
			</p>
			<Pagination class="shrink-0" bind:page count={totalItems} perPage={PER_PAGE} />
		</div>
	{/if}
{/snippet}

<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
	<label class="sr-only" for="admin-screenshot-query">{t('Filter by player')}</label>
	<Input
		id="admin-screenshot-query"
		class="max-w-xs"
		size="sm"
		bind:value={queryInput}
		placeholder={t('Steam ID or player name')}
		aria-label={t('Filter by player')}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				applyFilter();
			}
		}}
	/>
	<Button
		type="button"
		variant="secondary"
		size="sm"
		loading={loading}
		disabled={loading}
		onclick={() => applyFilter()}
	>
		<MagnifyingGlassIcon size={16} />
		{t('Search')}
	</Button>
	{#if isFiltered}
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label={t('Clear')}
			disabled={loading}
			onclick={clearFilter}
		>
			<XIcon size={16} />
		</Button>
	{/if}
	{#if items.length > 0 && !loading}
		<Button type="button" variant="ghost" size="sm" onclick={toggleSelectPage}>
			{allPageSelected ? t('Clear selection') : t('Select all')}
		</Button>
	{/if}
	{#if selectedCount > 0}
		<p class="text-secondary-400 text-xs tabular-nums">
			{t('{count} selected', { count: selectedCount })}
		</p>
		<Button type="button" variant="destructive" size="sm" onclick={askBulkDelete}>
			<TrashIcon size={16} />
			{t('Delete selected')}
		</Button>
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label={t('Clear selection')}
			onclick={clearSelection}
		>
			<XIcon size={16} />
		</Button>
	{/if}
	{#if totalItems > 0 && !loading}
		<p class="text-secondary-500 ms-auto text-xs tabular-nums">
			{t('{count} screenshots', { count: totalItems })}
		</p>
		<Pagination class="shrink-0" bind:page count={totalItems} perPage={PER_PAGE} />
	{/if}
</div>

{#if loading}
	<div class="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
		{#each SKELETON_KEYS as key (key)}
			<Skeleton class="aspect-video w-full rounded-none" />
		{/each}
	</div>
{:else if items.length === 0}
	<p class="text-secondary-400 px-4 py-6 text-sm">
		{isFiltered
			? t('No screenshots for this player. Screenshots only appear when they used the app.')
			: t('No screenshots yet.')}
	</p>
{:else}
	<div class="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-3">
		{#each items as capture (capture.id)}
			{@const meta = captureMeta(capture)}
			{@const owner = captureOwner(capture)}
			{@const selected = isSelected(capture.id)}
			<div
				class={cn(
					'group relative aspect-video overflow-clip',
					selected && 'ring-primary ring-2 ring-inset'
				)}
			>
				<button
					type="button"
					class={cn(
						interactive,
						'absolute inset-0 size-full',
						'opacity-80 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
						capture.hidden && 'opacity-50 group-hover:opacity-80'
					)}
					onclick={() => openCapture(capture)}
				>
					<CaptureImage {capture} class="absolute inset-0 size-full object-cover" />
				</button>
				<div
					class={cn(
						'pointer-events-auto absolute top-2 left-2 z-10 flex items-center gap-1.5',
						!selected &&
							selectedCount === 0 &&
							'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'
					)}
				>
					<div class="bg-black/55 rounded-sm p-0.5 backdrop-blur-sm">
						<Checkbox
							size="sm"
							class="border-white/50"
							checked={selected}
							aria-label={t('Select screenshot')}
							onCheckedChange={(value) => setSelected(capture.id, value === true)}
						/>
					</div>
					{#if capture.hidden}
						<Badge variant="warning">{t('Hidden')}</Badge>
					{/if}
				</div>
				<div
					class={cn(
						'pointer-events-auto absolute top-2 right-2 z-10 flex flex-wrap justify-end gap-1',
						'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'
					)}
				>
					{#if capture.hidden}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class={overlayActionClass}
							loading={actionId === capture.id}
							aria-label={t('Unhide')}
							{@attach tooltip(t('Unhide'))}
							onclick={(event) => void askUnhide(event, capture)}
						>
							<EyeIcon size={14} />
						</Button>
					{:else}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class={overlayActionClass}
							aria-label={t('Hide')}
							{@attach tooltip(t('Hide'))}
							onclick={(event) => askHide(event, capture)}
						>
							<EyeSlashIcon size={14} />
						</Button>
					{/if}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class={cn(overlayActionClass, 'hover:text-destructive')}
						aria-label={t('Delete')}
						{@attach tooltip(t('Delete'))}
						onclick={(event) => askDelete(event, capture)}
					>
						<TrashIcon size={14} />
					</Button>
				</div>
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/45 to-transparent px-3 pt-12 pb-2.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
				>
					{#if owner || capture.steam_id || capture.user}
						<button
							type="button"
							class={cn(
								interactive,
								'text-secondary-100 hover:text-primary pointer-events-auto block w-full truncate text-left text-sm font-medium'
							)}
							onclick={(event) => filterFromCapture(event, capture)}
						>
							{owner || capture.steam_id || capture.user}
						</button>
						{#if capture.steam_id}
							{#if owner}
								<PlayerProfileLink
									href="/players/{capture.steam_id}"
									playerId={capture.steam_id}
									class={cn(
										interactive,
										'text-secondary-400 hover:text-primary pointer-events-auto block truncate text-xs tabular-nums'
									)}
									onclick={(event) => event.stopPropagation()}
								>
									{capture.steam_id}
								</PlayerProfileLink>
							{:else}
								<PlayerProfileLink
									href="/players/{capture.steam_id}"
									playerId={capture.steam_id}
									class={cn(
										interactive,
										'text-secondary-400 hover:text-primary pointer-events-auto block truncate text-xs'
									)}
									onclick={(event) => event.stopPropagation()}
									aria-label={t('View profile')}
								>
									{t('View profile')}
								</PlayerProfileLink>
							{/if}
						{/if}
					{/if}
					{#if meta}
						<p class="text-secondary-300 truncate text-xs leading-snug">{meta}</p>
					{/if}
					<p class="text-secondary-400 text-xs tabular-nums">{captureDate(capture)}</p>
				</div>
			</div>
		{/each}
	</div>
	{@render paginationBar('border-t')}
{/if}
