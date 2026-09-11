<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { CommentComposer } from '@company-of-heroes/ui/comment';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { PlayerSteamLinks, type ReplaySteamLinkPlayer } from '@company-of-heroes/ui/replay';
	import { isValidSteamId, memberReplayRosterForEdit } from '@company-of-heroes/api';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { flagImageUrl, resolveAvatarUrl, resolveFactionFlag } from '$lib/utils/resolvers';
	import { raceFromReplayFaction } from '$lib/replays';
	import { href, useI18n } from '$lib/i18n';
	import {
		deleteMemberReplay,
		searchPlayersForUpload,
		updateMemberReplay
	} from '$lib/remote/replays.remote';
	import { searchMentionUsers } from '$lib/remote/match-social.remote';
	import { page } from '$app/state';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import type { PageData } from './$types';

	type RosterPlayer = {
		name?: string;
		alias?: string;
		faction?: string;
		steamId?: string | null;
		doctrineName?: string;
		id?: number;
	};

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const match = $derived(data.match);
	const detailHref = $derived(href(`/replays/${match.id}`));
	const memberReplaysHref = $derived(href('/replays?tab=member'));

	let title = $state('');
	let description = $state('');
	let roster = $state<RosterPlayer[]>([]);
	let linkedLabels = $state.raw<Record<string, string>>({});
	let confirmDelete = $state(false);
	let hydratedId = $state('');

	$effect(() => {
		const id = match.id;
		const nextRoster = memberReplayRosterForEdit(match);
		const shouldHydrate = hydratedId !== id || (roster.length === 0 && nextRoster.length > 0);
		if (!shouldHydrate) {
			return;
		}

		hydratedId = id;
		title = match.title?.trim() || '';
		description = match.description?.trim() || '';
		roster = nextRoster.map((player) => ({ ...player }));
		linkedLabels = {};
		confirmDelete = false;
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
	const excludeUserId = $derived(page.data.user?.id ?? '');

	const formError = $derived.by(() => {
		const issues = updateMemberReplay.fields.allIssues();
		if (!issues?.length) {
			return null;
		}

		return issues.map((issue) => t(issue.message)).join(' ');
	});

	const deleteError = $derived.by(() => {
		const issues = deleteMemberReplay.fields.allIssues();
		if (!issues?.length) {
			return null;
		}

		return issues.map((issue) => t(issue.message)).join(' ');
	});

	const canSave = $derived(
		title.trim().length > 0 && description.trim().length > 0 && !updateMemberReplay.pending
	);
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

		const results = await searchPlayersForUpload({ q });
		if (results.length > 0) {
			return results.map((player) => ({
				value: player.value,
				label: player.label,
				avatarUrl: player.avatarUrl ?? null,
				country: player.country ?? null,
				profileId: player.profileId ?? null
			}));
		}

		if (isValidSteamId(q)) {
			return [{ value: q, label: q, avatarUrl: null, country: null, profileId: null }];
		}

		return [];
	}

	function resolvePlayerProfileHref(steamId: string, profileId?: number | null) {
		const id = profileId && profileId > 0 ? profileId : steamId;
		return href(`/players/${id}`);
	}
</script>

<svelte:head>
	<title>{t('Edit replay')} | {t('Company of Heroes 1 Stats')}</title>
</svelte:head>

<form {...updateMemberReplay} class="border-secondary-800 border">
	<input {...updateMemberReplay.fields.id.as('hidden', match.id)} />
	<input {...updateMemberReplay.fields.players.as('hidden', JSON.stringify(roster))} />

	<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
		<a
			href={detailHref}
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
				<li>
					<a href={detailHref} class={cn(interactive, 'text-secondary-400 hover:text-primary')}>
						{match.title?.trim() || t('Replay')}
					</a>
				</li>
				<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
				<li class="min-w-0 truncate text-white">{t('Edit')}</li>
			</ol>
		</nav>
	</div>

	{#if formError}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{formError}</p>
	{/if}

	<Form.Group
		label={t('Title')}
		inputId="edit-member-replay-title"
		wide
		required
		requiredLabel={t('required')}
	>
		<input {...updateMemberReplay.fields.title.as('hidden', title)} />
		<Input
			id="edit-member-replay-title"
			bind:value={title}
			required
			maxlength={200}
			placeholder={t('Title')}
			aria-required="true"
		/>
	</Form.Group>

	<Form.Group
		label={t('Description')}
		inputId="edit-member-replay-description"
		wide
		required
		requiredLabel={t('required')}
	>
		<input {...updateMemberReplay.fields.description.as('hidden', description)} />
		<CommentComposer
			id="edit-member-replay-description"
			bind:value={description}
			boxed
			showSubmit={false}
			placeholder={t('Write a description')}
			searchMentions={searchMentionUsers}
			{excludeUserId}
			{...composerLabels}
		/>
	</Form.Group>

	{#if steamLinkPlayers.length > 0}
		<PlayerSteamLinks
			players={steamLinkPlayers}
			onLink={linkPlayerSteam}
			onSearchPlayers={searchPlayers}
			{resolveFactionFlag}
			raceFromFaction={raceFromReplayFaction}
			{resolveAvatarUrl}
			{flagImageUrl}
			resolvePlayerHref={resolvePlayerProfileHref}
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
	{:else}
		<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
			{t('No players found.')}
		</p>
	{/if}

	<div class="border-secondary-800 flex flex-col gap-2 border-t px-4 py-4">
		<div class="flex flex-wrap items-center gap-3">
			<Button type="submit" loading={!!updateMemberReplay.pending} disabled={!canSave}>
				{t('Save')}
			</Button>
			<Button type="button" variant="secondary" href={detailHref}>
				{t('Cancel')}
			</Button>
		</div>
		{#if requiredFieldsHint}
			<p class="text-secondary-400 text-sm">{requiredFieldsHint}</p>
		{/if}
	</div>
</form>

<form {...deleteMemberReplay} class="border-secondary-800 mt-4 border">
	<input {...deleteMemberReplay.fields.id.as('hidden', match.id)} />
	<div class="px-4 py-4">
		<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">
			{t('Delete replay')}
		</h2>
		<p class="text-secondary-400 mt-1 text-sm">
			{t('This hides the replay from the public catalog. Staff can still view it.')}
		</p>
		{#if deleteError}
			<p class="text-destructive mt-2 text-sm">{deleteError}</p>
		{/if}
		{#if !confirmDelete}
			<Button
				type="button"
				variant="destructive"
				class="mt-3"
				onclick={() => (confirmDelete = true)}
			>
				{t('Delete')}
			</Button>
		{:else}
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<Button type="submit" variant="destructive" loading={!!deleteMemberReplay.pending}>
					{t('Confirm delete')}
				</Button>
				<Button type="button" variant="secondary" onclick={() => (confirmDelete = false)}>
					{t('Cancel')}
				</Button>
			</div>
		{/if}
	</div>
</form>
