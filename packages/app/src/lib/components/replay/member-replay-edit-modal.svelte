<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import {
		CommentComposer,
		type MentionUser as ComposerMentionUser
	} from '@company-of-heroes/ui/comment';
	import { PlayerSteamLinks, type ReplaySteamLinkPlayer } from '@company-of-heroes/ui/replay';
	import { isValidSteamId, memberReplayRosterForEdit } from '@company-of-heroes/api';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import { userAvatarSrc } from '$lib/components/user/user-avatar-src';
	import { useI18n } from '$lib/i18n';
	import { getFactionFlagFromRace } from '$lib/utils';
	import type { ReplaysRecord } from '$core/pocketbase/types';
	import type { MentionUser } from '$core/app/database/match-social';

	type RosterPlayer = {
		name?: string;
		alias?: string;
		faction?: string;
		steamId?: string | null;
		doctrineName?: string;
		id?: number;
	};

	type Props = {
		replayId: string;
		record: ReplaysRecord;
		onDone: () => void;
		onDeleted: () => void;
		onCancel: () => void;
	};

	let { replayId, record, onDone, onDeleted, onCancel }: Props = $props();
	const { t } = useI18n();

	const initial = untrack(() => ({
		title: String(record.title || '').trim(),
		description: String(record.description || '').trim(),
		roster: memberReplayRosterForEdit({
			roster: record.players,
			players: record.players
		})
	}));

	let title = $state(initial.title);
	let description = $state(initial.description);
	let roster = $state<RosterPlayer[]>(initial.roster.map((player) => ({ ...player })));
	let linkedLabels = $state.raw<Record<string, string>>({});
	let error = $state<string | null>(null);
	let busy = $state(false);
	let confirmDelete = $state(false);
	let loadingRoster = $state(initial.roster.length === 0);

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

		if (!titleOk) {
			return t('Title is required.');
		}

		return t('Description is required.');
	});

	$effect(() => {
		const id = replayId;
		if (roster.length > 0) {
			loadingRoster = false;
			return;
		}

		let cancelled = false;
		loadingRoster = true;
		void unwrapApi(api.replays.getMember(id))
			.then((match) => {
				if (cancelled) {
					return;
				}

				const next = memberReplayRosterForEdit(match);
				if (next.length > 0) {
					roster = next.map((player) => ({ ...player }));
				}
			})
			.catch(() => {
				// keep PB roster / empty
			})
			.finally(() => {
				if (!cancelled) {
					loadingRoster = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	const steamLinkPlayers = $derived.by((): ReplaySteamLinkPlayer[] => {
		return roster.map((player, index) => {
			const steamId = player.steamId ? String(player.steamId) : null;
			return {
				key: String(index),
				name: player.name || player.alias || `Player ${index + 1}`,
				faction: player.faction,
				steamId,
				linkedLabel: steamId ? (linkedLabels[steamId] ?? null) : null
			};
		});
	});

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

	function raceFromFaction(faction: string) {
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

	function linkPlayerSteam(key: string, steamId: string | null, label?: string | null) {
		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index >= roster.length) {
			return;
		}

		const previous = roster[index]?.steamId ? String(roster[index]?.steamId) : null;
		roster = roster.map((player, playerIndex) => {
			if (playerIndex !== index) {
				return player;
			}

			if (!steamId) {
				return { ...player, steamId: undefined };
			}

			return { ...player, steamId: String(steamId) };
		});

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
			// fall through
		}

		if (isValidSteamId(q)) {
			return [{ value: q, label: q, avatarUrl: null, country: null, profileId: null }];
		}

		return [];
	}

	async function onSave() {
		if (busy || !title.trim() || !description.trim()) {
			return;
		}

		busy = true;
		error = null;
		try {
			await unwrapApi(
				api.replays.updateMember(replayId, {
					title: title.trim(),
					description: description.trim(),
					players: roster
				})
			);
			onDone();
		} catch (err) {
			error = err instanceof Error ? err.message : t('Failed to update replay.');
		} finally {
			busy = false;
		}
	}

	async function onDelete() {
		if (busy) {
			return;
		}

		busy = true;
		error = null;
		try {
			await unwrapApi(api.replays.deleteMember(replayId));
			onDeleted();
		} catch (err) {
			error = err instanceof Error ? err.message : t('Failed to delete replay.');
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	{#if error}
		<p class="text-destructive text-sm">{error}</p>
	{/if}

	<Form.Group
		label={t('Title')}
		inputId="app-edit-member-title"
		wide
		required
		requiredLabel={t('required')}
	>
		<Input
			id="app-edit-member-title"
			bind:value={title}
			required
			maxlength={200}
			placeholder={t('Title')}
			disabled={busy}
		/>
	</Form.Group>

	<Form.Group
		label={t('Description')}
		inputId="app-edit-member-description"
		wide
		required
		requiredLabel={t('required')}
	>
		<CommentComposer
			id="app-edit-member-description"
			bind:value={description}
			boxed
			showSubmit={false}
			placeholder={t('Write a description')}
			{searchMentions}
			excludeUserId={app.account.userId}
			{...composerLabels}
		/>
	</Form.Group>

	{#if loadingRoster}
		<p class="text-secondary-400 text-sm">{t('Loading…')}</p>
	{:else if steamLinkPlayers.length > 0}
		<PlayerSteamLinks
			players={steamLinkPlayers}
			onLink={linkPlayerSteam}
			onSearchPlayers={searchPlayers}
			resolveFactionFlag={getFactionFlagFromRace}
			{raceFromFaction}
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
			class="border-secondary-800 rounded-md border"
		/>
	{:else}
		<p class="text-secondary-400 text-sm">{t('No players found.')}</p>
	{/if}

	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center gap-3">
			<Button type="button" loading={busy} disabled={!canSave} onclick={() => void onSave()}>
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

	<div class="border-secondary-800 border-t pt-4">
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
				<Button
					type="button"
					variant="destructive"
					loading={busy}
					onclick={() => void onDelete()}
				>
					{t('Confirm delete')}
				</Button>
				<Button type="button" variant="secondary" disabled={busy} onclick={() => (confirmDelete = false)}>
					{t('Cancel')}
				</Button>
			</div>
		{/if}
	</div>
</div>
