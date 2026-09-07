<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { Textarea } from '@company-of-heroes/ui/input';
	import * as Dropdown from '@company-of-heroes/ui/dropdown';
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, dropdownItem, mePlayerText } from '@company-of-heroes/ui/variants';
	import {
		COMMENT_MAX_LENGTH,
		insertCommentMention,
		mentionQueryAt,
		toggleMarkdownQuote,
		wrapMarkdownLink,
		wrapMarkdownSelection,
		type MarkdownSelectionEdit
	} from './markdown';
	import { createTextareaCaretVirtualElement } from './textarea-caret-rect';
	import type { MentionUser } from './types';
	import { Debounced, resource } from 'runed';
	import { tick, type Snippet } from 'svelte';
	import AtIcon from 'phosphor-svelte/lib/At';
	import CodeIcon from 'phosphor-svelte/lib/CodeIcon';
	import HighlighterIcon from 'phosphor-svelte/lib/HighlighterIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import QuotesIcon from 'phosphor-svelte/lib/QuotesIcon';
	import TextBIcon from 'phosphor-svelte/lib/TextBIcon';
	import TextItalicIcon from 'phosphor-svelte/lib/TextItalicIcon';
	import TextStrikethroughIcon from 'phosphor-svelte/lib/TextStrikethroughIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		value?: string;
		posting?: boolean;
		name?: string;
		placeholder?: string;
		submitLabel?: string;
		searchingLabel?: string;
		noUsersLabel?: string;
		mentionHintLabel?: string;
		formattingLabel?: string;
		boldLabel?: string;
		italicLabel?: string;
		strikethroughLabel?: string;
		codeLabel?: string;
		linkLabel?: string;
		highlightLabel?: string;
		quoteLabel?: string;
		mentionLabel?: string;
		cancelLabel?: string;
		autofocus?: boolean;
		rows?: number;
		class?: string;
		id?: string;
		boxed?: boolean;
		people?: MentionUser[];
		excludeUserId?: string;
		searchMentions?: (query: string) => Promise<MentionUser[]>;
		identity?: Snippet;
		avatarUrl?: string;
		showSubmit?: boolean;
		onpost?: () => void;
		oncancel?: () => void;
	};

	let {
		value = $bindable(''),
		posting = false,
		name,
		placeholder = 'Write a comment',
		submitLabel = 'Send',
		searchingLabel = 'Searching...',
		noUsersLabel = 'No users found.',
		mentionHintLabel = 'Type a name to mention someone.',
		formattingLabel = 'Formatting',
		boldLabel = 'Bold',
		italicLabel = 'Italic',
		strikethroughLabel = 'Strikethrough',
		codeLabel = 'Code',
		linkLabel = 'Link',
		highlightLabel = 'Highlight',
		quoteLabel = 'Quote',
		mentionLabel = 'Mention',
		cancelLabel = 'Cancel',
		autofocus = false,
		rows = 3,
		class: className,
		id,
		boxed = false,
		people = [],
		excludeUserId = '',
		searchMentions,
		identity,
		avatarUrl,
		showSubmit = true,
		onpost,
		oncancel
	}: Props = $props();

	let composerEl = $state<HTMLTextAreaElement | undefined>();
	let cursor = $state(0);
	let mentionIndex = $state(0);
	let mentionSuppressedAt = $state<number | null>(null);
	/** Bumped on textarea scroll/resize so Floating UI re-reads the caret rect. */
	let mentionAnchorTick = $state(0);
	const canPost = $derived(value.trim().length > 0 && !posting);
	const formatBtn = 'text-secondary-400 hover:text-white size-7';
	const mention = $derived(mentionQueryAt(value, cursor));
	const mentionOpen = $derived(!!mention && mention.start !== mentionSuppressedAt);
	const mentionAnchor = $derived.by(() => {
		mentionAnchorTick;
		value;
		cursor;
		const el = composerEl;
		const start = mention?.start;
		if (!mentionOpen || !el || start == null) {
			return null;
		}

		return createTextareaCaretVirtualElement(el, start);
	});
	const debouncedMentionQuery = new Debounced(() => mention?.query ?? '', 200);
	const remoteMentions = resource(
		() => [mentionOpen, debouncedMentionQuery.current] as const,
		([open, query]) => {
			if (!open || !query.trim() || !searchMentions) {
				return Promise.resolve([] as MentionUser[]);
			}

			return searchMentions(query);
		}
	);
	const mentionResults = $derived.by(() => {
		const q = (mention?.query ?? '').trim().toLowerCase();
		const seen: Record<string, true> = {};
		const out: MentionUser[] = [];
		const add = (user: MentionUser) => {
			const id = user.id;
			const label = user.name.trim();
			if (!id || !label || seen[id] || id === excludeUserId) {
				return;
			}

			if (q && !label.toLowerCase().includes(q)) {
				return;
			}

			seen[id] = true;
			out.push(user);
		};
		for (const user of people) {
			add(user);
		}

		for (const user of remoteMentions.current ?? []) {
			add(user);
		}

		return out.slice(0, 6);
	});
	const mentionHighlight = $derived(
		mentionResults.length === 0 ? 0 : Math.min(mentionIndex, mentionResults.length - 1)
	);

	function closeMentions() {
		mentionSuppressedAt = mention?.start ?? null;
	}

	function onMentionOpenChange(open: boolean) {
		if (!open) {
			closeMentions();
		}
	}

	function onMentionInteractOutside(event: PointerEvent) {
		const el = composer();
		if (el && event.target instanceof Node && (event.target === el || el.contains(event.target))) {
			event.preventDefault();
		}
	}

	function grow(event: Event) {
		resize(event.currentTarget as HTMLTextAreaElement);
		refreshMentionAnchor();
	}

	function resize(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}

	function refreshMentionAnchor() {
		if (mentionOpen) {
			mentionAnchorTick += 1;
		}
	}

	function composer() {
		return composerEl ?? null;
	}

	function bindComposer(el: HTMLTextAreaElement) {
		composerEl = el;
		cursor = el.selectionStart;
		resize(el);
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshMentionAnchor) : null;
		ro?.observe(el);
		return () => {
			ro?.disconnect();
			if (composerEl === el) {
				composerEl = undefined;
			}
		};
	}

	$effect(() => {
		value;
		const el = composerEl;
		if (el) {
			resize(el);
		}
	});

	function syncCursor(event: Event) {
		const el = event.currentTarget as HTMLTextAreaElement;
		cursor = el.selectionStart;
	}

	async function applyFormat(edit: MarkdownSelectionEdit | null) {
		if (!edit || posting) {
			return;
		}

		value = edit.text;
		await tick();
		const el = composer();
		if (!el) {
			return;
		}

		el.focus();
		el.setSelectionRange(edit.selectStart, edit.selectEnd);
		cursor = edit.selectStart;
		resize(el);
	}

	function wrap(before: string, after: string, placeholderText: string) {
		const el = composer();
		if (!el) {
			return;
		}

		void applyFormat(
			wrapMarkdownSelection(
				value,
				el.selectionStart,
				el.selectionEnd,
				before,
				after,
				placeholderText
			)
		);
	}

	function formatCode() {
		const el = composer();
		if (!el) {
			return;
		}

		const selected = value.slice(el.selectionStart, el.selectionEnd);
		if (selected.includes('\n')) {
			wrap('```\n', '\n```', 'code');
			return;
		}

		wrap('`', '`', 'code');
	}

	function formatLink() {
		const el = composer();
		if (!el) {
			return;
		}

		void applyFormat(wrapMarkdownLink(value, el.selectionStart, el.selectionEnd));
	}

	function formatQuote() {
		const el = composer();
		if (!el) {
			return;
		}

		void applyFormat(toggleMarkdownQuote(value, el.selectionStart, el.selectionEnd));
	}

	async function pickMention(user: MentionUser) {
		const query = mention;
		if (!query || posting) {
			return;
		}

		await applyFormat(
			insertCommentMention(value, query.start, cursor, user.name, user.id, user.steamIds?.[0])
		);
	}

	function startMention() {
		const el = composer();
		if (!el || posting) {
			return;
		}

		mentionSuppressedAt = null;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const prefix = start > 0 && !/\s/.test(value[start - 1] ?? '') ? ' @' : '@';
		const text = value.slice(0, start) + prefix + value.slice(end);
		if (text.length > COMMENT_MAX_LENGTH) {
			return;
		}

		void applyFormat({
			text,
			selectStart: start + prefix.length,
			selectEnd: start + prefix.length
		});
	}

	function onComposerKeydown(event: KeyboardEvent) {
		if (mentionOpen && mentionResults.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				mentionIndex = Math.min(mentionHighlight + 1, mentionResults.length - 1);
				return;
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				mentionIndex = Math.max(mentionHighlight - 1, 0);
				return;
			}

			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				const user = mentionResults[mentionHighlight];
				if (user) {
					void pickMention(user);
				}

				return;
			}
		}

		if (event.key === 'Escape' && mentionOpen) {
			event.preventDefault();
			mentionSuppressedAt = mention?.start ?? null;
			return;
		}

		if (event.key === 'Escape' && oncancel && !posting) {
			event.preventDefault();
			oncancel();
			return;
		}

		if (!(event.ctrlKey || event.metaKey) || event.altKey) {
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			if (showSubmit) {
				onpost?.();
			}

			return;
		}

		if (event.key === 'b' || event.key === 'B') {
			event.preventDefault();
			wrap('**', '**', 'bold');
			return;
		}

		if (event.key === 'i' || event.key === 'I') {
			event.preventDefault();
			wrap('*', '*', 'italic');
			return;
		}

		if (event.key === 'k' || event.key === 'K') {
			event.preventDefault();
			formatLink();
		}
	}
</script>

<svelte:element
	this={showSubmit ? 'form' : 'div'}
	class={cn(
		boxed
			? cn(
					controlBase,
					'focus-within:border-secondary-600 flex h-auto w-full flex-col overflow-hidden p-0 focus:outline-none'
				)
			: 'border-secondary-800 bg-secondary-800/30 flex flex-col border-y',
		className
	)}
	onsubmit={showSubmit
		? (event: SubmitEvent) => {
				event.preventDefault();
				onpost?.();
			}
		: undefined}
>
	<div class="relative px-4 pt-3">
		<Dropdown.Root
			open={mentionOpen}
			side="top"
			align="start"
			sideOffset={4}
			customAnchor={mentionAnchor}
			preventAutoFocus
			trapFocus={false}
			preventScroll={false}
			class="max-h-32 w-52 overflow-y-auto"
			onOpenChange={onMentionOpenChange}
			onInteractOutside={onMentionInteractOutside}
		>
			{#if mentionResults.length === 0}
				<p class="text-secondary-400 px-4 py-2.5 text-xs">
					{#if remoteMentions.loading}
						{searchingLabel}
					{:else if (mention?.query ?? '').trim()}
						{noUsersLabel}
					{:else}
						{mentionHintLabel}
					{/if}
				</p>
			{:else}
				{#each mentionResults as user, index (user.id)}
					<Dropdown.Item
						class={cn(
							dropdownItem,
							'flex items-center gap-2 text-xs',
							index === mentionHighlight && 'bg-secondary-800/40 text-white'
						)}
						onSelect={() => void pickMention(user)}
					>
						{#if user.avatarUrl}
							<img src={user.avatarUrl} alt="" class="size-5 shrink-0 rounded-full object-cover" />
						{:else}
							<span
								class="bg-secondary-800 text-secondary-400 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]"
							>
								{user.name.slice(0, 1).toUpperCase()}
							</span>
						{/if}
						<span class="text-primary min-w-0 truncate">@{user.name}</span>
					</Dropdown.Item>
				{/each}
			{/if}
		</Dropdown.Root>
		{#if identity}
			{@render identity()}
		{:else if name}
			<div class="flex items-center gap-2">
				{#if avatarUrl}
					<img src={avatarUrl} alt="" class="size-8 shrink-0 rounded-full object-cover" />
				{:else}
					<span
						class="bg-secondary-800 text-secondary-400 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
					>
						{name.slice(0, 1).toUpperCase()}
					</span>
				{/if}
				<span class={cn(mePlayerText, 'font-semibold')}>{name}</span>
			</div>
		{/if}
		<Textarea
			flush
			{id}
			{@attach bindComposer}
			bind:value
			{rows}
			{autofocus}
			maxlength={COMMENT_MAX_LENGTH}
			{placeholder}
			aria-label={placeholder}
			onkeydown={onComposerKeydown}
			oninput={(event: Event) => {
				syncCursor(event);
				grow(event);
			}}
			onclick={syncCursor}
			onkeyup={syncCursor}
			onselect={syncCursor}
			onscroll={refreshMentionAnchor}
			class={cn('min-h-14 resize-none text-sm', name && 'mt-1 min-h-18')}
		/>
	</div>
	<div class="border-secondary-800 flex items-center gap-2 border-t px-2 py-1.5">
		<div
			role="toolbar"
			aria-label={formattingLabel}
			tabindex="-1"
			class="flex min-w-0 flex-1 flex-wrap items-center"
			onmousedown={(event) => event.preventDefault()}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={boldLabel}
				title={boldLabel}
				onclick={() => wrap('**', '**', 'bold')}
			>
				<TextBIcon size={16} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={italicLabel}
				title={italicLabel}
				onclick={() => wrap('*', '*', 'italic')}
			>
				<TextItalicIcon size={16} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={strikethroughLabel}
				title={strikethroughLabel}
				onclick={() => wrap('~~', '~~', 'text')}
			>
				<TextStrikethroughIcon size={16} />
			</Button>
			<span class="bg-secondary-800 mx-0.5 h-4 w-px"></span>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={codeLabel}
				title={codeLabel}
				onclick={formatCode}
			>
				<CodeIcon size={16} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={linkLabel}
				title={linkLabel}
				onclick={formatLink}
			>
				<LinkIcon size={16} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={highlightLabel}
				title={highlightLabel}
				onclick={() => wrap('==', '==', 'text')}
			>
				<HighlighterIcon size={16} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={quoteLabel}
				title={quoteLabel}
				onclick={formatQuote}
			>
				<QuotesIcon size={16} />
			</Button>
			<span class="bg-secondary-800 mx-0.5 h-4 w-px"></span>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={formatBtn}
				aria-label={mentionLabel}
				title={mentionLabel}
				onclick={startMention}
			>
				<AtIcon size={16} />
			</Button>
		</div>
		{#if oncancel}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class="text-secondary-400 shrink-0 hover:text-white"
				aria-label={cancelLabel}
				onclick={oncancel}
			>
				<XIcon size={16} />
			</Button>
		{/if}
		{#if showSubmit}
			<Button type="submit" size="sm" class="shrink-0" disabled={!canPost} loading={posting}>
				{submitLabel}
			</Button>
		{/if}
	</div>
</svelte:element>
