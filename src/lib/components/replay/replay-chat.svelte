<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Message } from '@fknoobs/replay-parser';
	import { useReplay } from '.';
	import { cn } from '$lib/utils';
	import ArrowBendDownLeft from 'phosphor-svelte/lib/ArrowBendDownLeft';
	import ArrowBendUpRight from 'phosphor-svelte/lib/ArrowBendUpRight';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
	let replay = useReplay();
</script>

{#snippet message(message: Message)}
	<div
		class={cn(
			'grid grid-cols-[4rem_auto_1fr] items-center gap-2',
			message.sender === 'System' && 'text-secondary-400!',
			replay.playerCount === 8 && (message.playerID < 1004 ? 'text-blue-400' : 'text-red-400'),
			replay.playerCount === 6 && (message.playerID < 1003 ? 'text-blue-400' : 'text-red-400'),
			replay.playerCount === 4 && (message.playerID < 1002 ? 'text-blue-400' : 'text-red-400'),
			replay.playerCount === 2 && (message.playerID < 1001 ? 'text-blue-400' : 'text-red-400'),
			message.recipient === 0 && 'text-primary!',
			(message.recipient === 3 || message.recipient === 4) && 'text-primary-50'
		)}
	>
		<span class="text-sm text-gray-200">{message.timestamp}</span>
		<span class="flex items-center gap-2">
			{#if message.recipient === 3}
				<ArrowBendDownLeft />
			{:else if message.recipient === 4}
				<ArrowBendUpRight />
			{/if}
			{message.sender}:
		</span>
		<span>{message.content}</span>
	</div>
{/snippet}

<div
	{...restProps}
	class={cn(
		'flex max-h-[500px] flex-col gap-1 overflow-auto rounded-xl bg-gray-950/40 px-6 py-4',
		restProps.class
	)}
>
	{#each replay.messages as m}
		{@render message(m)}
	{/each}
</div>
