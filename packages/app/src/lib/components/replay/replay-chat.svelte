<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Message } from '@fknoobs/replay-parser';
	import { useReplay } from '.';
	import { watch } from 'runed';
	import { cn } from '$lib/utils';
	import { translateText } from '$lib/translate';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { controlBase, controlDisabled } from '$lib/components/ui/variants';
	import ArrowBendDownLeft from 'phosphor-svelte/lib/ArrowBendDownLeft';
	import ArrowBendUpRight from 'phosphor-svelte/lib/ArrowBendUpRight';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
	let replay = $derived(useReplay());
	let targetLanguage = $state('en');
	let translatedContents = $state<Map<string, string> | null>(null);
	let translating = $state(false);

	function messageKey(message: Message, index: number) {
		return `${message.playerID}-${index}`;
	}

	function showOriginal() {
		translatedContents = null;
	}

	async function translateChat() {
		const language = targetLanguage.trim();
		if (!language || replay.messages.length === 0) {
			return;
		}

		translating = true;

		try {
			const entries = await Promise.all(
				replay.messages.map(async (message, index) => {
					const key = messageKey(message, index);
					const translated = await translateText(message.content, language);
					return [key, translated] as const;
				})
			);

			translatedContents = new Map(entries);
		} catch {
			app.toast.error('Translation failed');
		} finally {
			translating = false;
		}
	}

	watch(
		() => replay.messages,
		() => {
			translatedContents = null;
		}
	);
</script>

{#snippet message(message: Message, index: number)}
	{@const key = messageKey(message, index)}
	{@const displayContent = translatedContents?.get(key) ?? message.content}
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
		<span>{displayContent}</span>
	</div>
{/snippet}

<div {...restProps} class={cn('flex flex-col gap-2', restProps.class)}>
	<div class="flex items-center gap-2">
		<input
			type="text"
			placeholder="en"
			aria-label="Target language"
			bind:value={targetLanguage}
			disabled={translating}
			class={cn(controlBase, 'h-8 w-16 shrink-0 px-2 text-center text-sm', controlDisabled)}
		/>
		<Button
			size="sm"
			onclick={translateChat}
			loading={translating}
			disabled={translating || !targetLanguage.trim() || replay.messages.length === 0}
		>
			Translate
		</Button>
		{#if translatedContents}
			<Button size="sm" variant="secondary" onclick={showOriginal} disabled={translating}>
				Original
			</Button>
		{/if}
	</div>
	<div
		class={cn(
			'border-secondary-800 border',
			'bg-secondary-950/40 flex max-h-[500px] flex-col gap-1 overflow-auto rounded-xl px-6 py-4'
		)}
	>
		{#if replay.messages.length === 0}
			<span>No messages</span>
		{/if}
		{#each replay.messages as m, i (m.playerID + '-' + i)}
			{@render message(m, i)}
		{/each}
	</div>
</div>
