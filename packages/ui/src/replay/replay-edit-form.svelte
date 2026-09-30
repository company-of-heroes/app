<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack } from 'svelte';
	import CommentComposer from '../comment/comment-composer.svelte';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import * as Form from '../ui/form';
	import { Input } from '../ui/input';
	import ReplayPlayerSteamLinks, {
		type ReplaySteamLinkPlayer
	} from './replay-player-steam-links.svelte';
	import { memberReplayRosterForEdit, type MemberReplayRosterPlayer } from './roster';
	import type { CommunityMatchDetail } from './types';

	type Props = {
		/** The member replay being edited (owner only). */
		match: CommunityMatchDetail;
		onDone: () => void;
		onDeleted: () => void;
		onCancel: () => void;
	};

	let { match, onDone, onDeleted, onCancel }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const initial = untrack(() => ({
		title: match.title?.trim() || '',
		description: match.description?.trim() || '',
		roster: memberReplayRosterForEdit(match)
	}));

	let title = $state(initial.title);
	let description = $state(initial.description);
	let roster = $state<MemberReplayRosterPlayer[]>(initial.roster.map((player) => ({ ...player })));
	let linkedLabels = $state.raw<Record<string, string>>({});
	let error = $state<string | null>(null);
	let busy = $state(false);
	let confirmDelete = $state(false);

	const canSave = $derived(title.trim().length > 0 && description.trim().length > 0 && !busy);
	const requiredFieldsHint = $derived.by(() => {
		const titleOk = title.trim().length > 0;
		const descriptionOk = description.trim().length > 0;
		if (titleOk && descriptionOk) {
			return null;
		}

		if (!titleOk && !descriptionOk) {
			return t('Title and description are required.');
		}

		return titleOk ? t('Description is required.') : t('Title is required.');
	});

	const steamLinkPlayers = $derived(
		roster.map((player, index): ReplaySteamLinkPlayer => {
			const steamId = player.steamId ? String(player.steamId) : null;
			return {
				key: String(index),
				name: player.name || player.alias || t('Player {n}', { n: index + 1 }),
				faction: player.faction,
				steamId,
				linkedLabel: steamId ? (linkedLabels[steamId] ?? null) : null
			};
		})
	);

	function linkPlayerSteam(key: string, steamId: string | null, label?: string | null) {
		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index >= roster.length) {
			return;
		}

		const previous = roster[index]?.steamId ? String(roster[index]?.steamId) : null;
		roster = roster.map((player, playerIndex) =>
			playerIndex === index ? { ...player, steamId: steamId ? String(steamId) : undefined } : player
		);

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

	async function save() {
		if (!canSave) {
			return;
		}

		busy = true;
		error = null;
		try {
			await host.api.replays.update(match.id, {
				title: title.trim(),
				description: description.trim(),
				players: roster
			});
			host.notify.success(t('Replay updated'));
			onDone();
		} catch (err) {
			error = err instanceof Error ? t(err.message) : t('Failed to update replay.');
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (busy) {
			return;
		}

		busy = true;
		error = null;
		try {
			await host.api.replays.remove(match.id);
			host.notify.success(t('Replay deleted.'));
			onDeleted();
		} catch (err) {
			error = err instanceof Error ? t(err.message) : t('Failed to delete replay.');
			busy = false;
		}
	}
</script>

<div class="flex flex-col">
	{#if error}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{error}</p>
	{/if}

	<Form.Group
		label={t('Title')}
		inputId="edit-member-replay-title"
		wide
		required
		requiredLabel={t('required')}
	>
		<Input
			id="edit-member-replay-title"
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
		inputId="edit-member-replay-description"
		wide
		required
		requiredLabel={t('required')}
	>
		<CommentComposer
			id="edit-member-replay-description"
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
	{:else}
		<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
			{t('No players found.')}
		</p>
	{/if}

	<div class="flex flex-col gap-2 px-4 py-4">
		<div class="flex flex-wrap items-center gap-3">
			<Button type="button" loading={busy} disabled={!canSave} onclick={() => void save()}>
				{t('Save')}
			</Button>
			<Button type="button" variant="secondary" disabled={busy} onclick={onCancel}>
				{t('Cancel')}
			</Button>
		</div>
		{#if requiredFieldsHint}
			<p class="text-secondary-400 text-sm">{requiredFieldsHint}</p>
		{/if}
	</div>

	<div class="border-secondary-800 border-t px-4 py-4">
		<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">
			{t('Delete replay')}
		</h2>
		<p class="text-secondary-400 mt-1 text-sm">
			{t('This hides the replay from the public catalog. Staff can still view it.')}
		</p>
		{#if !confirmDelete}
			<Button
				type="button"
				variant="destructive"
				class="mt-3"
				disabled={busy}
				onclick={() => (confirmDelete = true)}
			>
				{t('Delete')}
			</Button>
		{:else}
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<Button type="button" variant="destructive" loading={busy} onclick={() => void remove()}>
					{t('Confirm delete')}
				</Button>
				<Button
					type="button"
					variant="secondary"
					disabled={busy}
					onclick={() => (confirmDelete = false)}
				>
					{t('Cancel')}
				</Button>
			</div>
		{/if}
	</div>
</div>
