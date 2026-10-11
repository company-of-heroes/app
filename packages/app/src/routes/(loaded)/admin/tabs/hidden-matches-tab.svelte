<script lang="ts">
	import { confirmation } from '$lib/components/ui/modal';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Form from '$lib/components/ui/form';
	import * as User from '$lib/components/user';
	import { app } from '$core/app/context';
	import { api } from '$core/api';
	import { pocketbase } from '$core/pocketbase';
	import { fetch } from '$core/http/fetch';
	import {
		addHiddenKeyword,
		deleteHiddenKeyword,
		listHiddenKeywords,
		listHiddenMatches,
		unhideMatch,
		type HiddenMatch,
		type HiddenMatchKeyword
	} from '$core/pocketbase/hidden-matches';
	import { invalidateHiddenMatchFilters } from '$lib/player/hidden-matches-cache';
	import { normalizeMapName } from '$lib/utils';
	import dayjs from '$lib/dayjs';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';
	import { mapLimit } from '@company-of-heroes/api';

	const { t } = useI18n();

	/** Session ids per `lobbies` lookup; one OR filter per chunk. */
	const MAP_CHUNK_SIZE = 100;

	type Row = HiddenMatch & { map?: string };

	const keywordColumns: ColumnDef<HiddenMatchKeyword>[] = [
		{ id: 'word', header: t('Title word'), width: 'w-8/24', class: 'font-medium' },
		{ id: 'createdBy', header: t('Added by'), width: 'w-6/24' },
		{
			id: 'createdAt',
			header: t('Added'),
			width: 'w-6/24',
			class: 'text-secondary-500 text-sm tabular-nums'
		},
		{ id: 'actions', header: '', width: 'w-4/24', class: 'text-right' }
	];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'session',
			header: t('Match ID'),
			width: 'w-5/24',
			class: 'tabular-nums'
		},
		{ id: 'map', header: t('Map'), width: 'w-7/24' },
		{ id: 'hiddenBy', header: t('Hidden by'), width: 'w-5/24' },
		{
			id: 'hiddenAt',
			header: t('Hidden at'),
			width: 'w-5/24',
			class: 'text-secondary-500 text-sm tabular-nums'
		},
		{ id: 'actions', header: '', width: 'w-2/24', class: 'text-right' }
	];

	let word = $state('');
	let keywords = $state<HiddenMatchKeyword[]>([]);
	let isSaving = $state(false);
	let deletingWordId = $state<string | null>(null);
	const canAdd = $derived(word.trim().length > 0 && !isSaving);

	let rows = $state<Row[]>([]);
	let isLoading = $state(false);
	let unhidingId = $state<number | null>(null);

	const isStaff = $derived(app.account.isStaff);

	watch(
		() => isStaff,
		(staff) => {
			if (staff) {
				void loadKeywords();
				void loadRows();
			}
		}
	);

	async function loadMaps(sessionIds: number[]): Promise<Record<number, string>> {
		const unique = [...new Set(sessionIds.filter((id) => id > 0))];
		if (unique.length === 0) {
			return {};
		}

		const chunks: number[][] = [];
		for (let i = 0; i < unique.length; i += MAP_CHUNK_SIZE) {
			chunks.push(unique.slice(i, i + MAP_CHUNK_SIZE));
		}

		try {
			const pages = await mapLimit(chunks, 4, (chunk) =>
				pocketbase.collection('lobbies').getList(1, chunk.length, {
					filter: chunk.map((id) => `sessionId=${id}`).join(' || '),
					fields: 'id,sessionId,map',
					fetch
				})
			);
			const maps: Record<number, string> = {};
			for (const lobby of pages.flatMap((page) => page.items)) {
				const sessionId = Number(lobby.sessionId);
				if (sessionId > 0 && lobby.map && !maps[sessionId]) {
					maps[sessionId] = lobby.map;
				}
			}
			return maps;
		} catch (error) {
			console.warn('[ADMIN]: hidden match map lookup failed:', error);
			return {};
		}
	}

	async function loadKeywords() {
		try {
			keywords = await listHiddenKeywords();
		} catch (error) {
			console.error('[ADMIN]: hidden title words load failed:', error);
			app.toast.error(t('Could not load title words.'));
		}
	}

	/** Hidden matches and title words change what profiles and match lists show. */
	function invalidateHiddenMatches() {
		invalidateHiddenMatchFilters();
		api.players.invalidate();
	}

	async function loadRows() {
		isLoading = true;
		try {
			const hidden = await listHiddenMatches();
			const maps = await loadMaps(hidden.map((row) => Number(row.sessionId)));
			rows = hidden.map((row) => ({
				...row,
				map: maps[Number(row.sessionId)]
			}));
		} catch (error) {
			console.error('[ADMIN]: hidden matches load failed:', error);
			app.toast.error(t('Could not load hidden matches.'));
		} finally {
			isLoading = false;
		}
	}

	async function addWord() {
		const next = word.trim();
		if (!next || isSaving) {
			return;
		}

		isSaving = true;
		try {
			await addHiddenKeyword(next);
			word = '';
			invalidateHiddenMatches();
			app.toast.success(t('Word added.'));
			await loadKeywords();
		} catch (error) {
			console.error('[ADMIN]: hidden title word add failed:', error);
			app.toast.error(t('Could not add this word.'));
		} finally {
			isSaving = false;
		}
	}

	async function removeWord(entry: HiddenMatchKeyword) {
		const confirmed = await confirmation.ask(t('Delete this word from the hide list?'), {
			confirm: t('Delete'),
			cancel: t('Cancel'),
			danger: true
		});
		if (!confirmed) {
			return;
		}

		deletingWordId = entry.id;
		try {
			await deleteHiddenKeyword(entry.id);
			invalidateHiddenMatches();
			app.toast.success(t('Word removed.'));
			await loadKeywords();
		} catch (error) {
			console.error('[ADMIN]: hidden title word delete failed:', error);
			app.toast.error(t('Could not delete this word.'));
		} finally {
			deletingWordId = null;
		}
	}

	async function showMatch(row: Row) {
		const confirmed = await confirmation.ask(t('Show this match on public overviews again?'), {
			confirm: t('Show'),
			cancel: t('Cancel')
		});
		if (!confirmed) {
			return;
		}

		unhidingId = Number(row.sessionId);
		try {
			await unhideMatch(Number(row.sessionId));
			invalidateHiddenMatches();
			app.toast.success(t('Match is visible again.'));
			await loadRows();
		} catch (error) {
			console.error('[ADMIN]: unhide failed:', error);
			app.toast.error(t('Could not show this match.'));
		} finally {
			unhidingId = null;
		}
	}
</script>

<Form.Group
	inputId="hidden-title-word"
	label={t('Title words')}
	description={t(
		'Matches whose Relic lobby name contains one of these words are hidden from public overviews.'
	)}
>
	<Input
		id="hidden-title-word"
		bind:value={word}
		placeholder="lean"
		aria-label={t('Title word')}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void addWord();
			}
		}}
	/>
	{#snippet footer()}
		<Button
			type="button"
			variant="secondary"
			class="w-fit"
			disabled={!canAdd}
			loading={isSaving}
			onclick={() => addWord()}
		>
			<PlusIcon size={16} />
			{t('Add word')}
		</Button>
	{/snippet}
</Form.Group>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Title words')}
		</p>
	</div>
	{#snippet cell_word({ row }: { row: HiddenMatchKeyword })}
		<span class="truncate">{row.word}</span>
	{/snippet}
	{#snippet cell_createdBy({ row }: { row: HiddenMatchKeyword })}
		{#if row.expand?.createdBy}
			<User.Root user={row.expand.createdBy}>
				<User.Name />
			</User.Root>
		{:else}
			<span class="truncate">{row.createdBy || '—'}</span>
		{/if}
	{/snippet}
	{#snippet cell_createdAt({ row }: { row: HiddenMatchKeyword })}
		{dayjs(row.created).format('D MMM YYYY HH:mm')}
	{/snippet}
	{#snippet cell_keywordActions({ row }: { row: HiddenMatchKeyword })}
		<div class="flex justify-end">
			<Button
				type="button"
				size="sm"
				variant="destructive"
				loading={deletingWordId === row.id}
				onclick={() => removeWord(row)}
			>
				{t('Delete')}
			</Button>
		</div>
	{/snippet}
	<DataTable
		data={keywords}
		columns={keywordColumns}
		rowKey={(row) => row.id}
		empty={t('No title words.')}
		class="rounded-none border-0"
		cells={{
			word: cell_word,
			createdBy: cell_createdBy,
			createdAt: cell_createdAt,
			actions: cell_keywordActions
		}}
	/>
</section>

<section>
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Hidden matches')}
		</p>
		<p class="text-secondary-500 mt-1 text-sm">
			{t('Hidden tournament results stay visible to staff until you show them again.')}
		</p>
	</div>
	{#snippet cell_session({ row }: { row: Row })}
		{row.sessionId}
	{/snippet}
	{#snippet cell_map({ row }: { row: Row })}
		<span class="truncate">{row.map ? normalizeMapName(row.map) : '—'}</span>
	{/snippet}
	{#snippet cell_hiddenBy({ row }: { row: Row })}
		{#if row.expand?.hiddenBy}
			<User.Root user={row.expand.hiddenBy}>
				<User.Name />
			</User.Root>
		{:else}
			<span class="truncate">{row.hiddenBy || '—'}</span>
		{/if}
	{/snippet}
	{#snippet cell_hiddenAt({ row }: { row: Row })}
		{dayjs(row.created).format('D MMM YYYY HH:mm')}
	{/snippet}
	{#snippet cell_actions({ row }: { row: Row })}
		<div class="flex justify-end">
			<Button
				type="button"
				size="sm"
				variant="secondary"
				loading={unhidingId === Number(row.sessionId)}
				onclick={() => showMatch(row)}
			>
				{t('Show')}
			</Button>
		</div>
	{/snippet}
	<DataTable
		data={rows}
		{columns}
		rowKey={(row) => row.id}
		loading={isLoading && rows.length === 0}
		empty={t('No hidden matches.')}
		class="rounded-none border-0"
		cells={{
			session: cell_session,
			map: cell_map,
			hiddenBy: cell_hiddenBy,
			hiddenAt: cell_hiddenAt,
			actions: cell_actions
		}}
	/>
</section>
