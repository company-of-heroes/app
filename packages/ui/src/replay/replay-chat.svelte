<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import type { ReplayMessage } from './types';
	import ArrowBendDownLeftIcon from 'phosphor-svelte/lib/ArrowBendDownLeftIcon';
	import ArrowBendUpRightIcon from 'phosphor-svelte/lib/ArrowBendUpRightIcon';

	type Props = {
		messages: ReplayMessage[];
		playerCount: number;
		emptyMessage?: string;
	};

	let { messages, playerCount, emptyMessage = 'No messages' }: Props = $props();

	const messageRow =
		'grid grid-cols-[3.75rem_minmax(0,auto)_1fr] sm:grid-cols-[4.5rem_minmax(0,auto)_1fr] items-start gap-x-2 sm:gap-x-3 gap-y-0.5 px-4 py-2.5 border-secondary-800 border-b last:border-b-0';

	function messageTone(message: ReplayMessage) {
		if (message.sender === 'System') return 'text-secondary-400';
		if (message.recipient === 0) return 'text-primary';
		if (message.recipient === 3 || message.recipient === 4) return 'text-primary-50';
		const isAllies =
			(playerCount === 8 && message.playerID < 1004) ||
			(playerCount === 6 && message.playerID < 1003) ||
			(playerCount === 4 && message.playerID < 1002) ||
			(playerCount === 2 && message.playerID < 1001);
		return isAllies ? 'text-blue-400' : 'text-red-400';
	}
</script>

<div class="bg-secondary-950/50 max-h-[32rem] overflow-auto">
	{#if messages.length === 0}
		<p class="text-secondary-400 px-4 py-3 text-sm">{emptyMessage}</p>
	{/if}
	{#each messages as message, i (message.playerID + '-' + i)}
		<div class={cn(messageRow, messageTone(message))}>
			<span class="text-secondary-500 pt-0.5 text-xs tabular-nums">{message.timestamp}</span>
			<span class="flex shrink-0 items-center gap-1.5 pt-0.5 font-semibold whitespace-nowrap">
				{#if message.recipient === 3}
					<ArrowBendDownLeftIcon class="size-3.5 shrink-0" />
				{:else if message.recipient === 4}
					<ArrowBendUpRightIcon class="size-3.5 shrink-0" />
				{/if}
				{message.sender}:
			</span>
			<span class="text-secondary-200 min-w-0 pt-0.5 wrap-break-word">{message.content}</span>
		</div>
	{/each}
</div>
