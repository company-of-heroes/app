<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Button } from '@company-of-heroes/ui/button';
	import { cn } from '@company-of-heroes/ui/cn';
	import { scoreClassName, type CommentVoteValue } from './vote';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';

	type Props = {
		score: number;
		vote?: CommentVoteValue;
		disabled?: boolean;
		compact?: boolean;
		/** `horizontal` sits inline in a comment's action row. */
		orientation?: 'vertical' | 'horizontal';
		href?: string;
		onvote?: (value: 1 | -1) => void;
		class?: string;
	};

	const { t } = useI18n();

	let {
		score,
		vote = 0,
		disabled = false,
		compact = false,
		orientation = 'vertical',
		href,
		onvote,
		class: className
	}: Props = $props();

	const upActive = $derived(vote === 1);
	const downActive = $derived(vote === -1);
	const scoreClass = $derived(scoreClassName(score));
	const horizontal = $derived(orientation === 'horizontal');
	const iconSize = $derived(compact || horizontal ? 16 : 18);

	function voteUp() {
		onvote?.(1);
	}

	function voteDown() {
		onvote?.(-1);
	}
</script>

<div
	class={cn('flex shrink-0 items-center', horizontal ? 'gap-0.5' : 'w-9 flex-col gap-2', className)}
>
	<Button
		type={href ? undefined : 'button'}
		{href}
		variant="ghost"
		size="icon-sm"
		class={cn(
			horizontal && 'size-7',
			upActive
				? 'bg-success/20 text-success hover:bg-success/30 hover:text-success'
				: 'text-secondary-300 hover:bg-success/15 hover:text-green-400'
		)}
		disabled={!href && disabled}
		aria-pressed={href ? undefined : upActive}
		aria-label={t('Upvote')}
		onclick={href ? undefined : voteUp}
	>
		<CaretUpIcon size={iconSize} weight="fill" />
	</Button>
	<span
		class={cn(
			'text-center text-sm leading-none font-bold tabular-nums',
			horizontal && 'min-w-5',
			scoreClass
		)}
	>
		{score}
	</span>
	<Button
		type={href ? undefined : 'button'}
		{href}
		variant="ghost"
		size="icon-sm"
		class={cn(
			horizontal && 'size-7',
			downActive
				? 'bg-destructive/20 hover:bg-destructive/30 text-red-400 hover:text-red-300'
				: 'text-secondary-300 hover:bg-destructive/15 hover:text-red-400'
		)}
		disabled={!href && disabled}
		aria-pressed={href ? undefined : downActive}
		aria-label={t('Downvote')}
		onclick={href ? undefined : voteDown}
	>
		<CaretDownIcon size={iconSize} weight="fill" />
	</Button>
</div>
