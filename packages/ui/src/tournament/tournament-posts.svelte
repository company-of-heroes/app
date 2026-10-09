<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { markdownProse } from '@company-of-heroes/ui/variants';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import FlagBannerIcon from 'phosphor-svelte/lib/FlagBannerIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassMediumIcon';
	import ListNumbersIcon from 'phosphor-svelte/lib/ListNumbersIcon';
	import MegaphoneIcon from 'phosphor-svelte/lib/MegaphoneIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import ProhibitIcon from 'phosphor-svelte/lib/ProhibitIcon';
	import PushPinIcon from 'phosphor-svelte/lib/PushPinIcon';
	import ScrollIcon from 'phosphor-svelte/lib/ScrollIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { renderMarkdown } from '../comment/markdown';
	import { formatDate, formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { POST_KIND_LABELS, postSummary, postTitle, roundLabel } from './format';
	import TournamentPostDialog from './tournament-post-dialog.svelte';
	import type {
		Tournament,
		TournamentBracket,
		TournamentMatch,
		TournamentPost,
		TournamentPostInput,
		TournamentPostKind
	} from './types';
	import { useTournament } from './context';

	type Props = {
		/** The list after a staff change. */
		onChange: (posts: TournamentPost[]) => void;
	};

	let { onChange }: Props = $props();
	const context = useTournament();
	const tournament = $derived(context.tournament);
	const posts = $derived(context.posts);
	const matches = $derived(context.matches);
	const { t } = useI18n();
	const host = useHost();

	let dialogOpen = $state(false);
	let editing = $state<TournamentPost | null>(null);
	let busy = $state(false);

	const staff = $derived(Boolean(host.auth.user?.isStaff));
	const canPost = $derived(staff && tournament.status !== 'draft');

	const ICONS: Record<TournamentPostKind, typeof MegaphoneIcon> = {
		announcement: MegaphoneIcon,
		rules: ScrollIcon,
		schedule: CalendarBlankIcon,
		deadlines: HourglassIcon,
		disqualified: ProhibitIcon,
		seeded: ListNumbersIcon,
		started: FlagBannerIcon,
		finished: TrophyIcon,
		cancelled: XCircleIcon
	};

	const dateTime = (iso: string) => formatDate(iso, host.locale(), 'dateTime');

	/** Pinned first, then newest first (also after a local change). */
	function sorted(list: TournamentPost[]) {
		return [...list].sort(
			(a, b) => Number(b.pinned) - Number(a.pinned) || b.created.localeCompare(a.created)
		);
	}

	/** Changed deadlines as "Semifinals: 12 Oct, 20:00", in bracket order. */
	function deadlineLines(
		post: TournamentPost
	): { key: string; label: string; date: string | null }[] {
		const rounds = post.data.rounds;
		if (!rounds || typeof rounds !== 'object') {
			return [];
		}

		return Object.entries(rounds as Record<string, string | null>)
			.map(([key, value]) => {
				const [bracket, round] = key.split(':') as [TournamentBracket, string];
				const inBracket = matches.filter((m) => m.bracket === bracket).map((m) => m.round);
				const label = roundLabel(
					t,
					tournament.format,
					{ bracket, round: Number(round) },
					Math.max(0, ...inBracket)
				);
				return { key, label, date: value ? dateTime(value) : null };
			})
			.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
	}

	function openNew() {
		editing = null;
		dialogOpen = true;
	}

	function openEdit(post: TournamentPost) {
		editing = post;
		dialogOpen = true;
	}

	async function save(input: TournamentPostInput) {
		try {
			if (editing) {
				const saved = await host.api.tournaments.updatePost(tournament.id, editing.id, input);
				onChange(sorted(posts.map((post) => (post.id === saved.id ? saved : post))));
				host.notify.success(t('Update saved.'));
			} else {
				const created = await host.api.tournaments.createPost(tournament.id, input);
				onChange(sorted([created, ...posts]));
				host.notify.success(t('Update posted. The participants got a notification.'));
			}

			dialogOpen = false;
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		}
	}

	async function togglePin(post: TournamentPost) {
		await run(async () => {
			const saved = await host.api.tournaments.updatePost(tournament.id, post.id, {
				title: post.title,
				body: post.body,
				important: post.important,
				pinned: !post.pinned
			});
			onChange(sorted(posts.map((item) => (item.id === saved.id ? saved : item))));
		});
	}

	async function remove(post: TournamentPost) {
		const ok = await host.notify.confirm(t('Delete this update?'), { confirm: t('Delete') });
		if (ok) {
			await run(async () => {
				await host.api.tournaments.deletePost(tournament.id, post.id);
				onChange(posts.filter((item) => item.id !== post.id));
			});
		}
	}

	async function run(action: () => Promise<void>) {
		if (busy) {
			return;
		}

		busy = true;
		try {
			await action();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			busy = false;
		}
	}
</script>

{#if canPost}
	<div class="border-secondary-800 flex flex-wrap items-center gap-3 border-b px-4 py-3">
		<p class="text-secondary-400 min-w-0 flex-1 text-sm">
			{t(
				'Rule changes, disqualifications, deadlines, the start and the end are posted here automatically.'
			)}
		</p>
		<Button size="sm" onclick={openNew}>
			<PlusIcon size={16} weight="bold" />
			{t('Post update')}
		</Button>
	</div>
{/if}

{#if posts.length === 0}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-6 text-sm">
		{t('No updates yet. News about this tournament shows up here, and participants get a message.')}
	</p>
{:else}
	<ol class="-mb-px">
		{#each posts as post (post.id)}
			{@const Icon = ICONS[post.kind]}
			{@const summary = postSummary(t, post, dateTime)}
			{@const lines = post.kind === 'deadlines' ? deadlineLines(post) : []}
			<li
				class={cn(
					'border-secondary-800 flex gap-4 border-b px-4 py-4',
					post.pinned && 'bg-primary/5'
				)}
			>
				<span
					class={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-full',
						post.kind === 'disqualified' || post.kind === 'cancelled'
							? 'bg-destructive/15 text-destructive'
							: post.kind === 'finished'
								? 'bg-warning/15 text-warning'
								: 'bg-primary/15 text-primary'
					)}
				>
					<Icon size={20} weight="duotone" />
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-1.5">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h3 class="font-heading text-lg leading-tight font-bold text-white">
							{postTitle(t, post)}
						</h3>
						<Badge variant="default" class="shrink-0">{t(POST_KIND_LABELS[post.kind])}</Badge>
						{#if post.important}
							<Badge variant="warning" class="shrink-0">{t('Important')}</Badge>
						{/if}
						{#if post.pinned}
							<span class="text-primary flex items-center gap-1 text-xs">
								<PushPinIcon size={14} weight="fill" />
								{t('Pinned')}
							</span>
						{/if}
					</div>
					<span class="text-secondary-500 w-fit text-xs" {@attach tooltip(dateTime(post.created))}>
						{formatRelative(Date.parse(post.created.replace(' ', 'T')) / 1000, host.locale())}
					</span>
					{#if summary}
						<p class="text-secondary-200 text-sm">{summary}</p>
					{/if}
					{#if lines.length}
						<ul class="text-secondary-300 flex flex-col gap-0.5 text-sm">
							{#each lines as line (line.key)}
								<li>
									<span class="text-white">{line.label}:</span>
									{line.date ?? t('no deadline')}
								</li>
							{/each}
						</ul>
					{/if}
					{#if post.body}
						<div class={cn(markdownProse, 'text-sm')}>
							{@html renderMarkdown(post.body)}
						</div>
					{/if}
				</div>
				{#if staff}
					<div class="flex shrink-0 items-start gap-1">
						<Button
							size="icon-sm"
							variant="ghost"
							disabled={busy}
							onclick={() => togglePin(post)}
							aria-label={post.pinned ? t('Unpin') : t('Pin')}
							{@attach tooltip(post.pinned ? t('Unpin') : t('Pin'))}
						>
							<PushPinIcon size={16} weight={post.pinned ? 'fill' : 'regular'} />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							disabled={busy}
							onclick={() => openEdit(post)}
							aria-label={t('Edit')}
							{@attach tooltip(t('Edit'))}
						>
							<PencilSimpleIcon size={16} />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							disabled={busy}
							onclick={() => remove(post)}
							aria-label={t('Delete')}
							{@attach tooltip(t('Delete'))}
						>
							<TrashIcon size={16} />
						</Button>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

{#if staff}
	<TournamentPostDialog
		open={dialogOpen}
		post={editing}
		onSave={save}
		onClose={() => (dialogOpen = false)}
	/>
{/if}
