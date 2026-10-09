<script lang="ts">
	import { goto } from '$app/navigation';
	import { revealItemInDir } from '@tauri-apps/plugin-opener';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { resource } from 'runed';
	import {
		Actions,
		Chat,
		DetailHeader,
		Overview,
		ReplayRenameForm,
		Root as ReplayRoot,
		Tabs,
		TabsSkeleton,
		formatReplayDurationLabel,
		type ReplayData
	} from '@company-of-heroes/ui/replay';
	import {
		loadReplayActionsAsync,
		parseReplayAsync,
		type FlatReplay
	} from '@company-of-heroes/ui/replay/parse';
	import { Button } from '@company-of-heroes/ui/button';
	import * as List from '@company-of-heroes/ui/list';
	import { modal } from '@company-of-heroes/ui/modal';
	import { toast } from '@company-of-heroes/ui/toasts';
	import { formatDate } from '@company-of-heroes/ui/format/date';
	import { detailMetaGrid } from '@company-of-heroes/ui/variants';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import { useI18n } from '$lib/i18n';
	import { replayHref, toCommunityMatch } from '$lib/library/community';
	import {
		replayMapLabel,
		replayTime,
		replayTitle,
		useReplayLibrary
	} from '$lib/library/replay-library.svelte';
	import type { ReplayEntry } from '$lib/library/types';
	import { escapeHtml, tooltip } from '@company-of-heroes/ui/attachments';

	type Props = {
		entry: ReplayEntry;
	};

	let { entry }: Props = $props();
	const i18n = useI18n();
	const { t } = i18n;
	const library = useReplayLibrary();

	let tab = $state('overview');

	const parsed = resource(
		() => entry.path,
		async (): Promise<ReplayData> => {
			const { parseId, replay } = await parseReplayAsync(await library.readBytes(entry));
			const flat = replay as FlatReplay;
			const actions = parseId === null ? [] : await loadReplayActionsAsync(parseId);
			return {
				playerCount: flat.playerCount,
				duration: flat.duration,
				players: flat.players.map((player) => ({ ...player, id: player.id ?? null })),
				messages: flat.messages,
				actions: actions as ReplayData['actions'],
				cpmByPlayerId: flat.cpmByPlayerId
			};
		}
	);

	const summary = $derived(entry.summary);
	const match = $derived(toCommunityMatch(entry));
	const mapName = $derived(replayMapLabel(summary) || t('Unknown map'));
	const isRanked = $derived(summary?.matchType === 'automatch');

	function rename() {
		modal.create({
			title: t('Rename replay'),
			size: 'sm',
			component: ReplayRenameForm,
			props: {
				initialName: replayTitle(entry),
				onCancel: () => modal.close(),
				onSave: async (name: string) => {
					try {
						const path = await library.rename(entry, name);
						toast.success(t('Replay name updated.'));
						modal.close();
						await goto(replayHref(path), { replaceState: true });
					} catch (error) {
						toast.error(error instanceof Error ? error.message : t('Could not rename the replay.'));
					}
				}
			}
		});
		modal.open();
	}

	async function remove() {
		const ok = await confirm(
			t('Delete {name}? This removes the file from your playback folder.', {
				name: entry.fileName
			}),
			{
				title: t('Delete replay'),
				okLabel: t('Delete'),
				cancelLabel: t('Cancel'),
				kind: 'warning'
			}
		);
		if (!ok) {
			return;
		}

		try {
			await library.remove(entry);
			toast.success(t('Replay deleted.'));
			await goto('/', { replaceState: true });
		} catch (error) {
			console.error('[replay-parser] delete failed', error);
			toast.error(t('Could not delete the replay.'));
		}
	}
</script>

<DetailHeader
	mapName={replayTitle(entry)}
	map={match.map}
	downloadCount={0}
	listHref="/"
	showDownload={false}
>
	{#snippet details()}
		<div class={detailMetaGrid}>
			<List.Title>{t('Map')}</List.Title>
			<List.Value class="truncate">{mapName}</List.Value>
			<List.Title>{t('Played')}</List.Title>
			<List.Value>
				{formatDate(new Date(replayTime(entry)), i18n.getLocale(), 'dateTime')}
			</List.Value>
			<List.Title>{t('Game mode')}</List.Title>
			<List.Value class="flex items-center gap-1.5">
				{#if isRanked}
					<RankingIcon class="text-primary-100" weight="duotone" />
					{t('Ranked')}
				{:else}
					{t('Custom match')}
				{/if}
			</List.Value>
			<List.Title>{t('Duration')}</List.Title>
			<List.Value>
				{formatReplayDurationLabel(summary?.durationSeconds, { na: t('N/A') })}
			</List.Value>
			<List.Title>{t('Player count')}</List.Title>
			<List.Value>{summary?.players.length ?? '—'}</List.Value>
			<List.Title>{t('Resources')}</List.Title>
			<List.Value>{summary?.highResources ? t('High') : t('Standard')}</List.Value>
			<List.Title>{t('Victory points')}</List.Title>
			<List.Value>{summary?.vpGame ? summary.vpCount : t('Annihilation')}</List.Value>
			<List.Title>{t('File')}</List.Title>
			<List.Value class="truncate" {@attach tooltip(escapeHtml(entry.path))}
				>{entry.fileName}</List.Value
			>
		</div>
	{/snippet}
	{#snippet actions()}
		<Button variant="secondary" onclick={rename}>
			<PencilSimpleIcon class="size-4" />
			{t('Rename')}
		</Button>
		<Button variant="secondary" onclick={() => void revealItemInDir(entry.path)}>
			<FolderOpenIcon class="size-4" />
			{t('Show in folder')}
		</Button>
		<!-- Soft red instead of the solid destructive fill. -->
		<Button
			variant="secondary"
			class="border-destructive/50 bg-destructive/10 hover:border-destructive/70 hover:bg-destructive/20 text-red-300"
			onclick={remove}
		>
			<TrashIcon class="size-4" />
			{t('Delete')}
		</Button>
	{/snippet}
</DetailHeader>

{#if parsed.current}
	{@const replay = parsed.current}
	<ReplayRoot {replay}>
		<Tabs bind:value={tab}>
			{#snippet overview()}
				<!-- Same order as the website: players, then the timeline. -->
				<Overview {match} showRanks={false} />
				<Actions />
			{/snippet}
			{#snippet chat()}
				{#if replay.messages.length > 0}
					<Chat />
				{:else}
					<p class="text-secondary-400 px-4 py-3 text-sm">
						{t('No chat messages in this replay.')}
					</p>
				{/if}
			{/snippet}
		</Tabs>
	</ReplayRoot>
{:else if parsed.error}
	<p class="text-destructive px-4 py-3 text-sm">{t('Could not parse this replay.')}</p>
{:else}
	<TabsSkeleton flush showTitle={false} />
{/if}
