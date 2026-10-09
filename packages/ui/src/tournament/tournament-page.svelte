<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack, type Snippet } from 'svelte';
	import { watch } from 'runed';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderTitle,
		markdownProse,
		tableHeadText
	} from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import TreeStructureIcon from 'phosphor-svelte/lib/TreeStructureIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon';
	import { renderMarkdown } from '../comment/markdown';
	import { formatDate, formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import { getCachedPlayerPreview } from '../player/player-preview-cache';
	import type { PlayerPreviewData } from '../player/types';
	import { Button } from '../ui/button';
	import { Badge } from '../ui/badge';
	import { Checkbox, Select } from '../ui/input';
	import { StaffSection } from '../ui/staff-section';
	import * as Tabs from '../ui/tabs';
	import { FORMAT_LABELS, isFull, isOpen, parseTournamentDate, registrationClosed } from './format';
	import TournamentBracket from './tournament-bracket.svelte';
	import TournamentDeadlinesDialog from './tournament-deadlines-dialog.svelte';
	import TournamentFeatured from './tournament-featured.svelte';
	import TournamentGuide from './tournament-guide.svelte';
	import TournamentMapThumb from './tournament-map-thumb.svelte';
	import TournamentMatchDialog from './tournament-match-dialog.svelte';
	import TournamentMyMatch from './tournament-my-match.svelte';
	import TournamentParticipants from './tournament-participants.svelte';
	import TournamentPosts from './tournament-posts.svelte';
	import TournamentReplays from './tournament-replays.svelte';
	import TournamentReportsDialog from './tournament-reports-dialog.svelte';
	import TournamentRoundRobin from './tournament-round-robin.svelte';
	import TournamentStats from './tournament-stats.svelte';
	import TournamentStatus from './tournament-status.svelte';
	import { createTournament } from './context';
	import type {
		MyTournamentMatch,
		TournamentDetail,
		TournamentMatch,
		TournamentMatchResult,
		TournamentParticipant,
		TournamentUpdate
	} from './types';
	import { escapeHtml, tooltip } from '../attachments';

	type Props = { detail: TournamentDetail };
	type Tab = 'bracket' | 'updates' | 'replays' | 'stats' | 'players' | 'info';

	let { detail }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let current = $state.raw(untrack(() => detail));
	// `?tab=updates` from a notification or popup opens that tab, if this tournament shows it.
	let tab = $state<Tab>(
		untrack(() => {
			const asked = host.url.param('tab');
			if (shows(detail, asked)) {
				return asked;
			}

			return detail.matches.length ? 'bracket' : 'info';
		})
	);
	let seenPosts = $state(untrack(() => readSeenPosts(detail.tournament.id)));
	let busy = $state(false);
	let editing = $state<TournamentMatch | null>(null);
	let deadlinesOpen = $state(false);
	// `?reports=1` from a staff notification opens the problem reports.
	let reportsOpen = $state(untrack(() => host.url.param('reports') === '1'));
	let rulesChecked = $state(false);
	let myMatches = $state.raw<MyTournamentMatch[]>([]);
	// Unknown until loaded: the guide only offers the download once we know the app is missing.
	let hasApp = $state(true);
	let steamId = $state(untrack(() => host.auth.user?.steamIds[0] ?? ''));
	const steamIds = $derived(host.auth.user?.steamIds ?? []);
	let accounts = $state.raw<Record<string, PlayerPreviewData>>({});

	watch(
		() => steamIds,
		(ids) => {
			if (ids.length < 2) {
				return;
			}

			void Promise.all(
				ids.map((id) => getCachedPlayerPreview(id, host.api.players.getPreview).catch(() => null))
			).then((previews) => {
				accounts = Object.fromEntries(
					previews.filter((preview) => preview != null).map((preview) => [preview.steamId, preview])
				);
			});
		}
	);

	watch(
		() => detail,
		(next) => {
			current = next;
		}
	);

	const tournament = $derived(current.tournament);
	const staff = $derived(Boolean(host.auth.user?.isStaff));
	// Tournament games stay hidden (spoilers) until the tournament ends.
	const gamesPublic = $derived(
		tournament.status === 'completed' || tournament.status === 'cancelled'
	);
	const participants = $derived(new Map(current.participants.map((p) => [p.id, p])));

	createTournament({
		get tournament() {
			return current.tournament;
		},
		get matches() {
			return current.matches;
		},
		get participants() {
			return current.participants;
		},
		get participantsById() {
			return participants;
		},
		get standings() {
			return current.standings;
		},
		get posts() {
			return current.posts;
		},
		get replays() {
			return current.replays;
		},
		get revealGames() {
			return gamesPublic;
		}
	});

	const me = $derived(current.participants.find((p) => p.user === host.auth.user?.id));

	// The signed-in player's open match here (deadline, played games, replays) and whether they
	// already use the desktop app.
	watch(
		() => [current, !!me] as const,
		([detail, playing]) => {
			if (!playing) {
				myMatches = [];
				return;
			}

			void host.api.tournaments
				.mine()
				.then((mine) => {
					hasApp = mine.hasApp;
					myMatches = mine.matches.filter((item) => item.tournament.id === detail.tournament.id);
				})
				.catch(() => {});
		}
	);
	const champion = $derived(tournament.winner ? participants.get(tournament.winner) : undefined);
	const description = $derived(
		tournament.description ? renderMarkdown(tournament.description) : ''
	);
	const rules = $derived(tournament.rules ? renderMarkdown(tournament.rules) : '');
	const starts = $derived(when(tournament.startsAt));
	const closes = $derived(
		tournament.status === 'registration' ? when(tournament.registrationClosesAt) : null
	);
	const fill = $derived(
		tournament.maxParticipants
			? Math.min(100, (tournament.participantCount / tournament.maxParticipants) * 100)
			: null
	);
	const canEditResults = $derived(staff && tournament.status === 'in_progress');
	const canSeed = $derived(staff && isOpen(tournament));
	const showReplays = $derived(hasReplays(current));
	const showStats = $derived(hasStats(current));
	const newestPost = $derived(
		current.posts.reduce((newest, post) => (post.created > newest ? post.created : newest), '')
	);
	const unreadPosts = $derived(newestPost > seenPosts);
	const playing = $derived(
		!!me && ['registration', 'seeding', 'in_progress'].includes(tournament.status)
	);
	const tabs = $derived<{ value: Tab; label: string; dot?: boolean }[]>([
		...(current.matches.length ? [{ value: 'bracket' as Tab, label: t('Bracket') }] : []),
		{
			value: 'updates',
			label: current.posts.length
				? t('Updates ({count})', { count: current.posts.length })
				: t('Updates'),
			dot: unreadPosts && tab !== 'updates'
		},
		...(showReplays
			? [
					{
						value: 'replays' as Tab,
						label: t('Replays ({count})', { count: current.replays.length })
					}
				]
			: []),
		...(showStats ? [{ value: 'stats' as Tab, label: t('Stats') }] : []),
		{ value: 'players', label: t('Players ({count})', { count: tournament.participantCount }) },
		{ value: 'info', label: t('Info') }
	]);

	function hasReplays(detail: TournamentDetail) {
		return detail.tournament.status === 'completed' && detail.replays.length > 0;
	}

	/** Stats only once every game is public. */
	function hasStats(detail: TournamentDetail) {
		return (
			detail.tournament.status === 'completed' ||
			(detail.tournament.status === 'cancelled' && detail.matches.some((m) => m.games.length > 0))
		);
	}

	/** Whether `value` is a tab this tournament renders. */
	function shows(detail: TournamentDetail, value: string | null): value is Tab {
		switch (value) {
			case 'bracket':
				return detail.matches.length > 0;
			case 'replays':
				return hasReplays(detail);
			case 'stats':
				return hasStats(detail);
			case 'updates':
			case 'players':
			case 'info':
				return true;
			default:
				return false;
		}
	}

	// A notification clicked while already on this page only changes the URL.
	watch(
		() => host.url.param('tab'),
		(asked) => {
			if (shows(current, asked)) {
				tab = asked;
			}
		},
		{ lazy: true }
	);

	watch(
		() => host.url.param('reports'),
		(reports) => {
			if (reports === '1') {
				reportsOpen = true;
			}
		},
		{ lazy: true }
	);

	// Signing up or withdrawing asks for the rules again next time.
	watch(
		() => !!me,
		() => {
			rulesChecked = false;
		},
		{ lazy: true }
	);

	/** Newest update this browser has seen per tournament, for the dot on the Updates tab. */
	function readSeenPosts(id: string): string {
		try {
			return localStorage.getItem(`tournament-updates-seen:${id}`) ?? '';
		} catch {
			return '';
		}
	}

	watch(
		() => [tab, newestPost] as const,
		([open, newest]) => {
			if (open !== 'updates' || !newest || newest <= seenPosts) {
				return;
			}

			seenPosts = newest;
			try {
				localStorage.setItem(`tournament-updates-seen:${tournament.id}`, newest);
			} catch {
				// Blocked storage: the dot shows again next visit.
			}
		}
	);

	/** `reloaded`: `run` answers with a fresh `get()`, whose open report count is the real one. */
	async function act(
		run: () => Promise<TournamentDetail | void>,
		success?: string,
		reloaded = false
	) {
		if (busy) {
			return;
		}

		busy = true;
		try {
			const next = await run();
			if (next) {
				// Action responses answer without the open report count; keep the one we have.
				current = reloaded ? next : { ...next, openReports: current.openReports };
			}

			if (success) {
				host.notify.success(success);
			}
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			busy = false;
		}
	}

	const reload = () => host.api.tournaments.get(tournament.id);

	function when(value: string | null) {
		const date = parseTournamentDate(value);
		const time = date ? Date.parse(date) : NaN;
		if (!Number.isFinite(time)) {
			return null;
		}

		return {
			date: formatDate(date, host.locale(), 'dateTime'),
			relative: formatRelative(time / 1000, host.locale())
		};
	}

	function setStatus(status: NonNullable<TournamentUpdate['status']>, message: string) {
		return act(
			async () => {
				await host.api.tournaments.update(tournament.id, { status });
				return reload();
			},
			message,
			true
		);
	}

	async function cancel() {
		const ok = await host.notify.confirm(t('Cancel this tournament? This cannot be undone.'), {
			confirm: t('Cancel tournament'),
			cancel: t('Keep it')
		});
		if (ok) {
			await setStatus('cancelled', t('Tournament cancelled.'));
		}
	}

	async function start() {
		const ok = await host.notify.confirm(
			t(
				'Start the tournament? The bracket is built from the current seeding and players can no longer sign up.'
			),
			{ confirm: t('Start tournament') }
		);
		if (ok) {
			await act(() => host.api.tournaments.start(tournament.id), t('Tournament started.'));
			tab = 'bracket';
		}
	}

	async function disqualify(participant: TournamentParticipant) {
		const ok = await host.notify.confirm(
			t('Disqualify {name}? They lose all their open and later matches.', {
				name: participant.alias
			}),
			{ confirm: t('Disqualify') }
		);
		if (ok) {
			await act(() => host.api.tournaments.disqualify(tournament.id, participant.id));
		}
	}

	async function saveMatchDeadline(match: TournamentMatch, deadline: string | null) {
		await act(async () => {
			const next = await host.api.tournaments.setMatchDeadline(tournament.id, match.id, deadline);
			editing = null;
			return next;
		}, t('Deadline saved.'));
	}

	async function saveMatchTime(match: TournamentMatch, scheduledAt: string | null) {
		await act(
			async () => {
				const next = await host.api.tournaments.setMatchTime(tournament.id, match.id, scheduledAt);
				editing = null;
				return next;
			},
			scheduledAt ? t('Match time saved.') : t('Match time cleared.')
		);
	}

	/** A player proposed or agreed on a time: the cards and "Your match" show it. */
	function refreshMine() {
		reload()
			.then((next) => (current = next))
			.catch(() => {});
	}

	async function featureMatch(match: TournamentMatch, featured: boolean) {
		await act(
			async () => {
				const next = await host.api.tournaments.feature(tournament.id, featured ? match.id : null);
				editing = null;
				return next;
			},
			featured ? t('Match featured.') : t('Match no longer featured.')
		);
	}

	async function saveRoundDeadlines(rounds: Record<string, string | null>) {
		await act(async () => {
			const next = await host.api.tournaments.setRoundDeadlines(tournament.id, rounds);
			deadlinesOpen = false;
			return next;
		}, t('Deadlines saved.'));
	}

	async function saveResult(match: TournamentMatch, result: TournamentMatchResult) {
		await act(
			async () => {
				await host.api.tournaments.setMatchResult(tournament.id, match.id, result);
				editing = null;
				return reload();
			},
			t('Result saved.'),
			true
		);
	}

	function reorder(order: TournamentParticipant[]) {
		return act(() =>
			host.api.tournaments.setSeeds(
				tournament.id,
				order.map((p) => p.id)
			)
		);
	}
</script>

{#snippet fact(
	label: string,
	Icon: typeof TrophyIcon,
	value: string,
	sub?: string | null,
	children?: Snippet
)}
	<div
		class="border-secondary-800 flex min-w-40 flex-1 basis-44 flex-col gap-1 border-r border-b px-4 py-3"
	>
		<span class={cn(tableHeadText, 'text-secondary-400 flex items-center gap-1.5')}>
			<Icon size={14} weight="fill" class="text-secondary-500" />
			{label}
		</span>
		<span class="font-heading truncate text-base font-bold text-white tabular-nums">{value}</span>
		{#if sub}
			<span class="text-secondary-400 truncate text-xs">{sub}</span>
		{/if}
		{@render children?.()}
	</div>
{/snippet}

{#snippet progress()}
	{#if fill !== null}
		<div class="bg-secondary-800 mt-1 h-1 overflow-hidden rounded-full">
			<div class="bg-primary h-full rounded-full" style:width="{fill}%"></div>
		</div>
	{/if}
{/snippet}

<header class="border-secondary-800 relative isolate shrink-0 overflow-hidden border-b">
	{#if tournament.bannerUrl}
		<img
			src={tournament.bannerUrl}
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
		/>
		<div
			class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/75 to-gray-950/10"
		></div>
	{:else}
		<div
			class="from-primary/10 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
		></div>
	{/if}
	<Button
		href={host.routes.tournaments()}
		variant="secondary"
		size="sm"
		class="absolute top-4 left-4 bg-gray-950/60 backdrop-blur-sm"
	>
		<ArrowLeftIcon size={16} />
		{t('All tournaments')}
	</Button>
	<div
		class={cn(
			'flex flex-col gap-6 px-4 pb-6 lg:flex-row lg:items-end lg:justify-between',
			tournament.bannerUrl ? 'pt-28 sm:pt-40' : 'pt-16'
		)}
	>
		<div class="flex min-w-0 items-end gap-4 sm:gap-5">
			{#if tournament.logoUrl}
				<img
					src={tournament.logoUrl}
					alt={t('{name} logo', { name: tournament.name })}
					class="border-secondary-700 size-20 shrink-0 rounded-md border bg-gray-950 object-cover shadow-lg shadow-black/50 sm:size-28"
				/>
			{:else}
				<div
					class="border-primary/20 bg-primary/5 text-primary flex size-20 shrink-0 items-center justify-center rounded-md border sm:size-28"
				>
					<TrophyIcon weight="duotone" class="size-10 sm:size-14" />
				</div>
			{/if}
			<div class="flex min-w-0 flex-col gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<TournamentStatus status={tournament.status} />
					<span class={cn(tableHeadText, 'text-primary')}>{t('Tournament')}</span>
				</div>
				<h1
					class="font-heading text-3xl leading-tight font-bold break-words text-white drop-shadow-md sm:text-4xl"
				>
					{tournament.name}
				</h1>
			</div>
		</div>

		{#if champion}
			<div
				class="border-warning/30 bg-warning/10 flex shrink-0 items-center gap-3 rounded-md border px-4 py-3 backdrop-blur-sm"
			>
				<TrophyIcon size={28} weight="duotone" class="text-warning shrink-0" />
				<p class="font-semibold text-white">
					{t('{name} won the tournament.', { name: champion.alias })}
				</p>
			</div>
		{:else if isOpen(tournament)}
			<div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-72">
				{#if me}
					<div class="flex flex-wrap items-center gap-3">
						<span class="text-success flex items-center gap-1.5 font-semibold">
							<CheckCircleIcon size={20} weight="fill" />
							{t('You are signed up.')}
						</span>
						<Button
							variant="secondary"
							disabled={busy}
							onclick={() =>
								act(() => host.api.tournaments.withdraw(tournament.id), t('You withdrew.'))}
						>
							{t('Withdraw')}
						</Button>
					</div>
				{:else if registrationClosed(tournament)}
					<p class="text-secondary-300 text-sm">{t('Registration is closed.')}</p>
				{:else if isFull(tournament)}
					<p class="text-secondary-300 text-sm">{t('This tournament is full.')}</p>
				{:else if !host.auth.user}
					<Button href={host.routes.login()} class="w-full justify-center">
						{t('Sign in to join')}
					</Button>
				{:else if steamIds.length === 0}
					<p class="text-secondary-300 text-sm">{t('Link a Steam account to join.')}</p>
				{:else}
					{#if steamIds.length > 1}
						<Select
							items={steamIds.map((id) => ({ value: id, label: accounts[id]?.alias ?? id }))}
							type="single"
							bind:value={steamId}
							aria-label={t('Steam account')}
						>
							{#snippet item({ value, label })}
								{@const avatar = accounts[value]?.avatarUrl}
								{#if avatar}
									<img
										src={host.resolve.avatarUrl(avatar)}
										alt=""
										class="size-5 shrink-0 rounded object-cover"
									/>
								{:else}
									<span class="bg-secondary-800 size-5 shrink-0 rounded"></span>
								{/if}
								<span class="truncate">{label}</span>
							{/snippet}
						</Select>
					{/if}
					{#if tournament.rules.trim()}
						<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
							<Checkbox
								bind:checked={rulesChecked}
								size="sm"
								disabled={busy}
								label={t('I have read and accept the rules')}
							/>
							<Button variant="link" size="sm" onclick={() => (tab = 'info')}>
								{t('Read the rules')}
							</Button>
						</div>
					{/if}
					<Button
						class="w-full justify-center"
						disabled={busy || !steamId || (!!tournament.rules.trim() && !rulesChecked)}
						onclick={() =>
							act(
								() =>
									host.api.tournaments.register(
										tournament.id,
										steamId,
										!!tournament.rules.trim() && rulesChecked
									),
								t('You are signed up.')
							)}
					>
						<SwordIcon size={18} weight="fill" />
						{t('Join tournament')}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
</header>

<!-- Every fact draws its own right and bottom line; the wrapper clips the last right line. -->
<div class="shrink-0 overflow-hidden">
	<div class="-mr-px flex flex-wrap">
		{#if starts}
			<!-- "in 2 hours" only while it has not started; a planned time can pass the real start. -->
			{@render fact(
				t('Starts'),
				CalendarBlankIcon,
				starts.date,
				['draft', 'registration', 'seeding'].includes(tournament.status)
					? starts.relative
					: undefined
			)}
		{/if}
		{#if closes}
			{@render fact(t('Registration closes'), ClockIcon, closes.date, closes.relative)}
		{/if}
		{@render fact(
			t('Players'),
			UsersThreeIcon,
			tournament.maxParticipants
				? `${tournament.participantCount} / ${tournament.maxParticipants}`
				: String(tournament.participantCount),
			null,
			progress
		)}
		{@render fact(t('Format'), TreeStructureIcon, t(FORMAT_LABELS[tournament.format]))}
		{@render fact(
			t('Match length'),
			SwordIcon,
			t('Best of {count}', { count: tournament.bestOf }),
			tournament.finalsBestOf && tournament.format !== 'round_robin'
				? t('Final: best of {count}', { count: tournament.finalsBestOf })
				: null
		)}
	</div>
</div>

{#if staff && tournament.status !== 'completed' && tournament.status !== 'cancelled'}
	<StaffSection class="border-t-0 border-b" contentClass="flex flex-wrap items-center gap-2 py-2.5">
		<Button variant="secondary" size="sm" href={host.routes.tournamentEdit(tournament.slug)}>
			{t('Edit')}
		</Button>
		{#if tournament.status === 'draft'}
			<Button
				size="sm"
				disabled={busy}
				onclick={() => setStatus('registration', t('Registration is open.'))}
			>
				{t('Open registration')}
			</Button>
		{/if}
		{#if isOpen(tournament)}
			<Button
				variant="secondary"
				size="sm"
				disabled={busy}
				onclick={() => {
					tab = 'players';
					return act(() => host.api.tournaments.seed(tournament.id), t('Players seeded by ELO.'));
				}}
			>
				{tournament.status === 'seeding'
					? t('Seed again by ELO')
					: t('Close registration and seed')}
			</Button>
		{/if}
		{#if tournament.status === 'seeding'}
			<Button
				variant="secondary"
				size="sm"
				disabled={busy}
				onclick={() => setStatus('registration', t('Registration is open.'))}
			>
				{t('Reopen registration')}
			</Button>
			<Button size="sm" disabled={busy || tournament.participantCount < 2} onclick={start}>
				{t('Start tournament')}
			</Button>
		{/if}
		{#if tournament.status === 'in_progress' && current.matches.length}
			<Button variant="secondary" size="sm" disabled={busy} onclick={() => (deadlinesOpen = true)}>
				{t('Deadlines')}
			</Button>
		{/if}
		{#if tournament.status !== 'draft'}
			<Button variant="secondary" size="sm" onclick={() => (reportsOpen = true)}>
				{t('Reports')}
				{#if current.openReports > 0}
					<Badge variant="warning">{current.openReports}</Badge>
				{/if}
			</Button>
		{/if}
		<Button variant="ghost" size="sm" disabled={busy} onclick={cancel} class="sm:ml-auto">
			{t('Cancel tournament')}
		</Button>
	</StaffSection>
{/if}

{#if tournament.status === 'in_progress' && myMatches.length}
	<div class={flushHeader}>
		<p class={flushHeaderTitle}>{t('Your match')}</p>
	</div>
	<TournamentMyMatch items={myMatches} onChange={refreshMine} />
{/if}

{#if playing && me}
	<TournamentGuide
		{me}
		{hasApp}
		match={myMatches[0] ?? null}
		onTab={(next) => (tab = next)}
		onChange={(next) => (current = { ...next, openReports: current.openReports })}
	/>
{/if}

<TournamentFeatured />

<Tabs.Root bind:value={tab}>
	<Tabs.List class="border-secondary-800 border-b px-4">
		{#each tabs as item (item.value)}
			<Tabs.Trigger value={item.value}>
				{item.label}
				{#if item.dot}
					<span class="bg-primary ml-1.5 inline-block size-2 rounded-full" aria-hidden="true"
					></span>
					<span class="sr-only">{t('New updates')}</span>
				{/if}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#if current.matches.length}
		<Tabs.Content value="bracket">
			{#if tournament.format === 'round_robin'}
				<TournamentRoundRobin onEdit={canEditResults ? (match) => (editing = match) : undefined} />
			{:else}
				<TournamentBracket onEdit={canEditResults ? (match) => (editing = match) : undefined} />
			{/if}
		</Tabs.Content>
	{/if}
	<Tabs.Content value="updates">
		<TournamentPosts onChange={(posts) => (current = { ...current, posts })} />
	</Tabs.Content>
	{#if showReplays}
		<Tabs.Content value="replays">
			<TournamentReplays />
		</Tabs.Content>
	{/if}
	{#if showStats}
		<Tabs.Content value="stats">
			<TournamentStats />
		</Tabs.Content>
	{/if}
	<Tabs.Content value="players">
		{#if canSeed && tournament.status === 'seeding'}
			<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
				{t(
					'Move players up or down to change the seeding. Seed 1 and 2 can only meet in the final.'
				)}
			</p>
		{/if}
		<TournamentParticipants
			showPlacement={tournament.status === 'completed'}
			onReorder={canSeed && tournament.status === 'seeding' ? reorder : undefined}
			onDisqualify={staff && tournament.status === 'in_progress' ? disqualify : undefined}
			showRules={staff && !!tournament.rules.trim()}
			{busy}
		/>
	</Tabs.Content>
	<Tabs.Content value="info">
		{#if description}
			<div class="border-secondary-800 border-b px-4 py-4">
				<div class={cn(markdownProse, 'text-sm')}>
					{@html description}
				</div>
			</div>
		{/if}
		<div class={flushHeader}>
			<p class={flushHeaderTitle}>{t('Rules')}</p>
		</div>
		<div class="border-secondary-800 border-b px-4 py-4">
			{#if rules}
				<div class={cn(markdownProse, 'text-sm')}>
					{@html rules}
				</div>
			{:else}
				<p class="text-secondary-400 text-sm">{t('No extra rules.')}</p>
			{/if}
		</div>
		{#if tournament.mapPool.length}
			<div class={flushHeader}>
				<p class={flushHeaderTitle}>{t('Map pool')}</p>
			</div>
			<ul
				class="border-secondary-800 grid grid-cols-[repeat(auto-fill,minmax(7rem,8.5rem))] gap-3 border-b px-4 py-4"
			>
				{#each tournament.mapPool as map (map.ref)}
					<li class="flex min-w-0 flex-col gap-2">
						<TournamentMapThumb {map} class="w-full" />
						<span
							class="text-secondary-200 truncate text-sm"
							{@attach tooltip(escapeHtml(map.name))}>{map.name}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Tabs.Content>
</Tabs.Root>

<TournamentMatchDialog
	match={editing}
	onSave={saveResult}
	onDeadline={saveMatchDeadline}
	onFeature={featureMatch}
	featured={!!editing && editing.id === tournament.featuredMatch}
	onTime={saveMatchTime}
	onClose={() => (editing = null)}
/>

{#if staff}
	<TournamentDeadlinesDialog
		open={deadlinesOpen}
		onSave={saveRoundDeadlines}
		onClose={() => (deadlinesOpen = false)}
	/>
	<TournamentReportsDialog
		open={reportsOpen}
		onClose={() => {
			reportsOpen = false;
			host.url.dropParam('reports');
		}}
		onChange={refreshMine}
	/>
{/if}
