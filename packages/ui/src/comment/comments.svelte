<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource, watch } from 'runed';
	import { cn } from '../cn';
	import { useHost, type CommentTarget } from '../host/host.context';
	import PlayerLabels from '../player/player-labels.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { interactive, markdownProse, mePlayerText } from '../variants';
	import CommentComposer from './comment-composer.svelte';
	import CommentDeleteDialog from './comment-delete-dialog.svelte';
	import CommentDeletedNote from './comment-deleted-note.svelte';
	import CommentVote from './comment-vote.svelte';
	import { insertCommentMention, renderMarkdown } from './markdown';
	import type { LobbyComment, MentionUser } from './types';
	import { compareCommentsByScore, nextCommentScore, nextCommentVote } from './vote';
	import ArrowBendUpLeftIcon from 'phosphor-svelte/lib/ArrowBendUpLeftIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import ChatsCircleIcon from 'phosphor-svelte/lib/ChatsCircleIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';

	type Props = {
		target: CommentTarget;
		class?: string;
	};

	type CommentNode = {
		id: string;
		comment: LobbyComment | null;
		children: CommentNode[];
	};

	type RepliesToggle = {
		count: number;
		open: boolean;
		ontoggle: () => void;
	};

	let { target, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const kind = $derived(target.kind);
	const user = $derived(host.auth.user);
	const loginHref = $derived(host.routes.login());
	const userAvatar = $derived(user ? host.resolve.userAvatar(user) : undefined);
	const searchMentions = (query: string) => host.api.comments.searchMentions(query);
	/** `?comment=<id>` deep links scroll to and flash that comment. */
	const highlightCommentId = $derived(host.url.param('comment'));
	const comments = resource(
		() => `${target.kind}:${target.id}`,
		() => host.api.comments.list(target)
	);

	let draft = $state('');
	let posting = $state(false);
	let deletingId = $state<string | null>(null);
	let deleteOpen = $state(false);
	let pendingDelete = $state<LobbyComment | null>(null);
	let votingId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editDraft = $state('');
	let saving = $state(false);
	let replyTo = $state<string | null>(null);
	let replyDraft = $state('');
	let replyPosting = $state(false);
	let threadCollapsed = $state<Record<string, boolean>>({});
	let activeHighlightId = $state<string | null>(null);
	let focusedHighlightId = $state<string | null>(null);
	const items = $derived(comments.current ?? []);
	const tree = $derived(buildTree(items));
	const myName = $derived(user?.name || t('Player'));
	const liveCount = $derived(items.filter((item) => !item.deleted).length);
	const staff = $derived(user?.isStaff ?? false);
	const commentAction = 'h-7 gap-1.5 px-2 text-xs';
	const quickReplies = $derived([
		t('GG'),
		t('Well played'),
		t('Great micro'),
		t('What a comeback')
	]);
	const people = $derived.by(() => {
		const me = user?.id;
		const seen: Record<string, true> = {};
		const out: MentionUser[] = [];
		for (const item of items) {
			if (item.deleted) {
				continue;
			}

			const id = item.user.id;
			const label = item.user.name.trim();
			if (!id || !label || seen[id] || id === me) {
				continue;
			}

			seen[id] = true;
			out.push({
				id,
				name: label,
				avatarUrl: host.resolve.userAvatar(item.user),
				steamIds: item.user.steamIds
			});
		}

		return out;
	});

	function buildTree(list: LobbyComment[]): CommentNode[] {
		const ids: Record<string, true> = {};
		for (const item of list) {
			ids[item.id] = true;
		}

		const byParent: Record<string, LobbyComment[]> = {};
		const missing: string[] = [];
		const seenMissing: Record<string, true> = {};
		for (const comment of list) {
			const parent = comment.parent;
			if (parent && !ids[parent]) {
				if (!seenMissing[parent]) {
					seenMissing[parent] = true;
					missing.push(parent);
				}

				(byParent[parent] ??= []).push(comment);
				continue;
			}

			const key = parent && ids[parent] ? parent : '';
			(byParent[key] ??= []).push(comment);
		}

		function nodes(key: string): CommentNode[] {
			return (byParent[key] ?? [])
				.slice()
				.sort(compareCommentsByScore)
				.map((comment) => ({
					id: comment.id,
					comment,
					children: nodes(comment.id)
				}));
		}

		const roots = nodes('');
		for (const id of missing) {
			roots.push({
				id,
				comment: null,
				children: nodes(id)
			});
		}

		return roots
			.slice()
			.sort((a, b) => compareCommentsByScore(a.comment, b.comment))
			.map((root) => ({
				id: root.id,
				comment: root.comment,
				children: flattenNodes(root.children).sort((a, b) =>
					compareCommentsByScore(a.comment, b.comment)
				)
			}));
	}

	function flattenNodes(nodes: CommentNode[]): CommentNode[] {
		const out: CommentNode[] = [];
		const walk = (list: CommentNode[]) => {
			for (const node of list) {
				out.push({ id: node.id, comment: node.comment, children: [] });
				walk(node.children);
			}
		};
		walk(nodes);
		return out;
	}

	function canManage(comment: LobbyComment) {
		return !comment.deleted && (comment.user.id === user?.id || staff);
	}

	function staffDeletedNote(comment: LobbyComment) {
		return comment.deletedNote.trim();
	}

	function mentionsUser(text: string, userId: string) {
		return text.includes(`mention:${userId}`);
	}

	function mentionToken(comment: LobbyComment) {
		const id = comment.user.id;
		const name = comment.user.name;
		if (!id || !name) {
			return '';
		}

		const steamId = comment.user.steamIds?.[0];
		return insertCommentMention('', 0, 0, name, id, steamId)?.text ?? `@${name} `;
	}

	function displayText(comment: LobbyComment) {
		const parent = comment.parent;
		if (!parent) {
			return comment.text;
		}

		const repliedTo = items.find((item) => item.id === parent);
		if (!repliedTo || !repliedTo.parent) {
			return comment.text;
		}

		const id = repliedTo.user.id;
		if (!id || mentionsUser(comment.text, id)) {
			return comment.text;
		}

		return mentionToken(repliedTo) + comment.text;
	}

	function threadRootId(commentId: string) {
		const all = comments.current ?? [];
		let current = commentId;
		for (let i = 0; i < 16; i++) {
			const item = all.find((comment) => comment.id === current);
			if (!item) {
				return current;
			}

			const parent = item.parent;
			if (!parent) {
				return current;
			}

			current = parent;
		}

		return current;
	}

	function patchComment(id: string, patch: Partial<LobbyComment>) {
		comments.mutate(
			(comments.current ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item))
		);
	}

	function requireUser() {
		return !!user;
	}

	function toggleReply(id: string) {
		if (!requireUser()) {
			return;
		}

		if (replyTo === id) {
			replyTo = null;
			replyDraft = '';
			return;
		}

		cancelEdit();
		replyTo = id;
		const comment = items.find((item) => item.id === id);
		replyDraft = comment && comment.parent ? mentionToken(comment) : '';
	}

	function startEdit(comment: LobbyComment) {
		if (editingId === comment.id) {
			cancelEdit();
			return;
		}

		replyTo = null;
		replyDraft = '';
		editingId = comment.id;
		editDraft = comment.text;
	}

	function cancelEdit() {
		if (saving) {
			return;
		}

		editingId = null;
		editDraft = '';
	}

	function countReplies(node: CommentNode): number {
		let n = 0;
		for (const child of node.children) {
			n += 1 + countReplies(child);
		}

		return n;
	}

	function threadOpen(id: string, childDepth: number) {
		if (threadCollapsed[id] === undefined) {
			return childDepth <= 1;
		}

		return !threadCollapsed[id];
	}

	function toggleThread(id: string, childDepth: number) {
		threadCollapsed[id] = threadOpen(id, childDepth);
	}

	function expandAncestors(targetId: string) {
		const all = comments.current ?? [];
		const next = { ...threadCollapsed };
		let current = targetId;
		while (current) {
			const item = all.find((comment) => comment.id === current);
			if (!item) {
				break;
			}

			const parent = item.parent;
			if (!parent) {
				break;
			}

			next[parent] = false;
			current = parent;
		}

		threadCollapsed = next;
	}

	function formatCommentDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return '';
		}

		return date.toLocaleString(host.locale(), {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function authorHref(comment: LobbyComment) {
		const steamId = comment.user.steamIds?.[0];
		return steamId ? host.routes.player(steamId) : undefined;
	}

	watch(
		() => ({
			target: highlightCommentId,
			list: items,
			loading: comments.loading
		}),
		({ target, list, loading }) => {
			if (!target || loading) {
				return;
			}

			if (!list.some((comment) => comment.id === target)) {
				return;
			}

			if (focusedHighlightId === target) {
				return;
			}

			focusedHighlightId = target;
			expandAncestors(target);
			activeHighlightId = target;
			const scrollTimeout = window.setTimeout(() => {
				document
					.getElementById(`comment-${target}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 50);
			host.url.dropParam('comment');
			const timeout = window.setTimeout(() => {
				if (activeHighlightId === target) {
					activeHighlightId = null;
				}
			}, 3000);
			return () => {
				clearTimeout(scrollTimeout);
				clearTimeout(timeout);
			};
		}
	);

	/** Briefly tints a comment the user just posted so they see where it landed. */
	function flash(id: string) {
		activeHighlightId = id;
		window.setTimeout(() => {
			document
				.getElementById(`comment-${id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}, 50);
		window.setTimeout(() => {
			if (activeHighlightId === id) {
				activeHighlightId = null;
			}
		}, 2000);
	}

	async function submit() {
		const text = draft.trim();
		if (!text || posting || !user) {
			return;
		}

		posting = true;
		try {
			const created = await host.api.comments.create(target, text);
			draft = '';
			comments.mutate([...(comments.current ?? []), created]);
			flash(created.id);
		} catch {
			host.notify.error(t('Failed to post comment.'));
		} finally {
			posting = false;
		}
	}

	async function submitReply() {
		const parent = replyTo;
		const text = replyDraft.trim();
		if (!parent || !text || replyPosting || !user) {
			return;
		}

		replyPosting = true;
		try {
			const created = await host.api.comments.create(target, text, parent);
			replyDraft = '';
			replyTo = null;
			threadCollapsed[threadRootId(parent)] = false;
			comments.mutate([...(comments.current ?? []), created]);
			flash(created.id);
		} catch {
			host.notify.error(t('Failed to post comment.'));
		} finally {
			replyPosting = false;
		}
	}

	async function setVote(comment: LobbyComment, value: 1 | -1) {
		if (!user || votingId) {
			return;
		}

		const prevVote = comment.vote;
		const prevCount = comment.likeCount ?? 0;
		votingId = comment.id;
		patchComment(comment.id, {
			vote: nextCommentVote(prevVote, value),
			likeCount: nextCommentScore(prevCount, prevVote, value)
		});
		try {
			const result = await host.api.comments.vote(kind, comment.id, value);
			patchComment(comment.id, { vote: result.vote, likeCount: result.likeCount });
		} catch {
			patchComment(comment.id, { vote: prevVote, likeCount: prevCount });
			host.notify.error(t('Failed to update vote.'));
		} finally {
			votingId = null;
		}
	}

	async function saveEdit() {
		const id = editingId;
		const text = editDraft.trim();
		if (!id || !text || saving) {
			return;
		}

		saving = true;
		try {
			const updated = await host.api.comments.update(kind, id, text);
			const previous = (comments.current ?? []).find((item) => item.id === id);
			patchComment(id, {
				text: updated.text,
				updated: updated.updated,
				vote: previous?.vote ?? 0,
				likeCount: previous?.likeCount ?? updated.likeCount
			});
			editingId = null;
			editDraft = '';
		} catch {
			host.notify.error(t('Failed to update comment.'));
		} finally {
			saving = false;
		}
	}

	function requestDelete(comment: LobbyComment) {
		if (comment.deleted || deletingId) {
			return;
		}

		pendingDelete = comment;
		deleteOpen = true;
	}

	async function confirmDelete(note: string) {
		const comment = pendingDelete;
		if (!comment || deletingId) {
			return;
		}

		deletingId = comment.id;
		try {
			const updated = await host.api.comments.remove(kind, comment.id, staff ? note : undefined);
			if (replyTo === comment.id) {
				replyTo = null;
				replyDraft = '';
			}

			if (editingId === comment.id) {
				cancelEdit();
			}

			if (staff) {
				patchComment(comment.id, {
					deleted: true,
					deletedNote: updated.deletedNote,
					text: updated.text
				});
			} else {
				comments.mutate((comments.current ?? []).filter((item) => item.id !== comment.id));
			}

			deleteOpen = false;
			pendingDelete = null;
		} catch {
			host.notify.error(t('Failed to delete comment.'));
		} finally {
			deletingId = null;
		}
	}
</script>

<section class={cn('border-secondary-800 border-t', className)}>
	<div class="border-secondary-800 flex items-center gap-2 border-b px-4 py-2.5">
		<h2 class="font-bold text-white">{t('Comments')}</h2>
		{#if liveCount > 0}
			<span class="bg-secondary-800 text-secondary-400 px-1.5 py-0.5 text-xs tabular-nums">
				{liveCount}
			</span>
		{/if}
	</div>

	<div class="flex flex-col">
		{#if comments.loading && items.length === 0}
			<p class="text-secondary-400 px-4 py-4 text-sm">{t('Loading...')}</p>
		{:else if items.length === 0}
			<div class="flex items-center gap-3.5 px-4 py-4">
				<ChatsCircleIcon size={32} weight="duotone" class="text-secondary-600 shrink-0" />
				<div class="min-w-0">
					<p class="font-semibold text-white">{t('No comments yet.')}</p>
					<p class="text-secondary-400 text-sm">{t('Start the conversation about this match.')}</p>
				</div>
			</div>
		{:else}
			{#each tree as node (node.id)}
				<div class="border-secondary-800 border-b last:border-b-0">
					{@render commentBlock(node, 0)}
				</div>
			{/each}
		{/if}
	</div>

	{#if user}
		<CommentComposer
			bind:value={draft}
			{posting}
			{people}
			collapsible
			suggestions={quickReplies}
			placeholder={t('What did you think of this match?')}
			name={myName}
			avatarUrl={userAvatar}
			excludeUserId={user.id}
			{searchMentions}
			onpost={() => void submit()}
		/>
	{:else}
		<p class="text-secondary-400 border-secondary-800 border-t px-4 py-3 text-sm">
			<a href={loginHref} class={cn(interactive, 'text-primary hover:underline')}>{t('Log in')}</a>
			{t('to post a comment.')}
		</p>
	{/if}
</section>

<CommentDeleteDialog
	bind:open={deleteOpen}
	requireNote={staff}
	title={t('Delete comment')}
	description={t('This comment will be hidden from other users.')}
	notePlaceholder={t('Why is this comment being deleted?')}
	confirmLabel={staff ? t('Save') : t('Delete')}
	onconfirm={(note) => void confirmDelete(note)}
	oncancel={() => {
		pendingDelete = null;
	}}
/>

{#snippet replyComposer()}
	<CommentComposer
		class="bg-transparent"
		bind:value={replyDraft}
		posting={replyPosting}
		{people}
		rows={2}
		placeholder={t('Write a reply')}
		name={myName}
		avatarUrl={userAvatar}
		excludeUserId={user?.id ?? ''}
		{searchMentions}
		onpost={() => void submitReply()}
	/>
{/snippet}

{#snippet commentBlock(node: CommentNode, depth: number)}
	{@const comment = node.comment}
	{@const open = threadOpen(node.id, depth + 1)}
	{@const replyCount = countReplies(node)}
	{@const replies =
		depth === 0 && replyCount > 0
			? {
					count: replyCount,
					open,
					ontoggle: () => toggleThread(node.id, depth + 1)
				}
			: undefined}
	{#if comment}
		{@render commentRow(comment, depth > 0, replies)}
		{#if !comment.deleted && replyTo === comment.id}
			{@render replyComposer()}
		{/if}
	{:else}
		{@render placeholderRow(node.id, depth > 0, replies)}
	{/if}
	{#if replyCount > 0 && open}
		{@render thread(node.children, depth + 1)}
	{/if}
{/snippet}

{#snippet thread(nodes: CommentNode[], depth: number)}
	{#if nodes.length > 0}
		<div class="border-secondary-800 border-t">
			<div class={cn(depth <= 4 && 'border-secondary-800 ml-8 border-l')}>
				{#each nodes as node (node.id)}
					<div class="border-secondary-800 border-b last:border-b-0">
						{@render commentBlock(node, depth)}
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet repliesToggle(replies: RepliesToggle)}
	<Button
		type="button"
		variant="ghost"
		size="sm"
		class={cn(commentAction, 'text-primary hover:text-primary hover:bg-primary/10 font-semibold')}
		onclick={replies.ontoggle}
		aria-expanded={replies.open}
		aria-label={replies.open ? t('Hide replies') : t('Show replies')}
	>
		<CaretDownIcon
			size={14}
			class={cn('shrink-0 transition-transform', !replies.open && '-rotate-90')}
		/>
		{replies.count === 1 ? t('1 reply') : t('{count} replies', { count: replies.count })}
	</Button>
{/snippet}

{#snippet placeholderRow(id: string, nested: boolean, replies?: RepliesToggle)}
	<div
		id={`comment-${id}`}
		class={cn(
			'scroll-mt-24 opacity-50 transition-opacity hover:opacity-100',
			!nested && 'bg-secondary-800/30',
			nested ? 'px-3 py-2.5' : 'px-4 py-3.5'
		)}
	>
		{#if staff}
			<Badge variant="warning">{t('Deleted comment')}</Badge>
		{:else}
			<p class="text-secondary-500 text-sm italic">{t('Comment has been deleted')}</p>
		{/if}
		{#if replies}
			<div class="mt-1.5 -ml-2 flex">
				{@render repliesToggle(replies)}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet commentRow(comment: LobbyComment, nested: boolean, replies?: RepliesToggle)}
	{@const mine = comment.user.id === user?.id}
	{@const editing = editingId === comment.id}
	{@const href = authorHref(comment)}
	{@const deleted = comment.deleted}
	{@const avatar = host.resolve.userAvatar(comment.user)}
	<div
		id={`comment-${comment.id}`}
		class={cn(
			'scroll-mt-24 transition-colors duration-500',
			!nested && 'bg-secondary-800/30',
			activeHighlightId === comment.id && 'bg-primary/15',
			deleted && 'opacity-50 transition-opacity hover:opacity-100'
		)}
	>
		<div
			class={cn(
				'flex gap-3.5',
				nested ? 'px-3 pt-2.5' : 'px-4 pt-3.5',
				editing ? 'pb-3' : 'pb-1.5'
			)}
		>
			{#if avatar}
				<img
					src={avatar}
					alt=""
					class={cn(nested ? 'size-6' : 'size-8', 'mt-0.5 shrink-0 rounded-full object-cover')}
				/>
			{:else}
				<span
					class={cn(
						nested ? 'size-6 text-[10px]' : 'size-8 text-xs',
						'bg-secondary-800 text-secondary-400 mt-0.5 flex shrink-0 items-center justify-center rounded-full font-semibold'
					)}
				>
					{comment.user.name.slice(0, 1).toUpperCase()}
				</span>
			{/if}
			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
					<PlayerStreamerIcon steamId={comment.user.steamIds?.[0]} />
					{#if href}
						{@const steamId = comment.user.steamIds?.[0]}
						{#if steamId}
							<PlayerProfileLink
								{href}
								playerId={steamId}
								class={cn(
									interactive,
									'shrink-0 font-semibold',
									mine ? mePlayerText : 'hover:text-primary text-white'
								)}
							>
								{comment.user.name}
							</PlayerProfileLink>
						{:else}
							<a
								{href}
								class={cn(
									interactive,
									'shrink-0 font-semibold',
									mine ? mePlayerText : 'hover:text-primary text-white'
								)}
							>
								{comment.user.name}
							</a>
						{/if}
					{:else}
						<span class={cn('shrink-0 font-semibold', mine ? mePlayerText : 'text-white')}>
							{comment.user.name}
						</span>
					{/if}
					{#if comment.user.steamIds?.[0]}
						<PlayerLabels labels={host.api.labels.forSteamId(comment.user.steamIds[0])} size="sm" />
					{/if}
					<time
						class="text-secondary-500 text-xs whitespace-nowrap tabular-nums"
						datetime={comment.created}
					>
						{formatCommentDate(comment.created)}
					</time>
					{#if deleted && staff}
						<Badge variant="warning">{t('Deleted comment')}</Badge>
					{/if}
				</div>
				{#if !editing}
					{#if deleted && !staff}
						<p class="text-secondary-500 mt-1 text-sm italic">
							{t('Comment has been deleted')}
						</p>
					{:else}
						<div class={cn(markdownProse, 'mt-1')}>
							{@html renderMarkdown(displayText(comment))}
						</div>
					{/if}
					{#if deleted && staff}
						{@const note = staffDeletedNote(comment)}
						{#if note}
							<div class="mt-2">
								<CommentDeletedNote reason={note} label={t('Moderator note')} />
							</div>
						{/if}
					{/if}
					{#if !deleted || replies}
						<div class="mt-1 -ml-2 flex flex-wrap items-center gap-0.5">
							{#if !deleted}
								<CommentVote
									score={comment.likeCount ?? 0}
									vote={comment.vote ?? 0}
									orientation="horizontal"
									disabled={!!votingId}
									href={user ? undefined : loginHref}
									onvote={user ? (value) => void setVote(comment, value) : undefined}
								/>
								<Button
									type={user ? 'button' : undefined}
									href={user ? undefined : loginHref}
									variant="ghost"
									size="sm"
									class={cn(
										commentAction,
										replyTo === comment.id
											? 'text-primary hover:text-primary'
											: 'text-secondary-400 hover:text-white'
									)}
									onclick={user ? () => toggleReply(comment.id) : undefined}
									aria-pressed={replyTo === comment.id}
								>
									<ArrowBendUpLeftIcon size={14} />
									{t('Reply')}
								</Button>
								{#if canManage(comment)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class={cn(commentAction, 'text-secondary-400 hover:text-white')}
										onclick={() => startEdit(comment)}
										aria-label={t('Edit comment')}
									>
										<PencilSimpleIcon size={14} />
										{t('Edit')}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class={cn(
											commentAction,
											'text-secondary-400 hover:bg-destructive/10 hover:text-red-400'
										)}
										onclick={() => requestDelete(comment)}
										disabled={deletingId === comment.id}
										aria-label={t('Delete comment')}
									>
										<TrashIcon size={14} />
										{t('Delete')}
									</Button>
								{/if}
							{/if}
							{#if replies}
								{@render repliesToggle(replies)}
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
		{#if editing}
			<CommentComposer
				bind:value={editDraft}
				posting={saving}
				{people}
				rows={2}
				autofocus
				placeholder={t('Edit comment')}
				submitLabel={t('Save comment')}
				excludeUserId={user?.id ?? ''}
				{searchMentions}
				onpost={() => void saveEdit()}
				oncancel={cancelEdit}
			/>
		{/if}
	</div>
{/snippet}
