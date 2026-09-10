<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FlatReplayMessage } from '$lib/utils/flatten-replay';
	import { useReplay } from '.';
	import { watch } from 'runed';
	import { cn } from '$lib/utils';
	import { translateText } from '$lib/translate';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { controlBase, controlDisabled, mePlayerText } from '$lib/components/ui/variants';
	import { isMeReplayAlias } from '$lib/utils/player-me';
	import ArrowBendDownLeft from 'phosphor-svelte/lib/ArrowBendDownLeftIcon';
	import ArrowBendUpRight from 'phosphor-svelte/lib/ArrowBendUpRightIcon';
	import { useI18n } from '$lib/i18n';

	type Props = {} & HTMLAttributes<HTMLDivElement> & {
		flush?: boolean;
	};

	let { flush = false, ...restProps }: Props = $props();
	const { t } = useI18n();
	let replay = $derived(useReplay());
	let targetLanguage = $state('en');
	let translatedContents = $state<Map<string, string> | null>(null);
	let translating = $state(false);

	const messageRow =
		'grid grid-cols-[4.5rem_minmax(0,auto)_1fr] items-start gap-x-3 gap-y-0.5 px-4 py-2.5';

	function messageKey(message: FlatReplayMessage, index: number) {
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
			app.toast.error(t('Translation failed'));
		} finally {
			translating = false;
		}
	}

	function messageTone(message: FlatReplayMessage) {
		if (message.sender === 'System') return 'text-secondary-400';
		if (isMeReplayAlias(message.sender)) return mePlayerText;
		if (message.recipient === 0) return 'text-primary';
		if (message.recipient === 3 || message.recipient === 4) return 'text-primary-50';

		const isAllies =
			(replay.playerCount === 8 && message.playerID < 1004) ||
			(replay.playerCount === 6 && message.playerID < 1003) ||
			(replay.playerCount === 4 && message.playerID < 1002) ||
			(replay.playerCount === 2 && message.playerID < 1001);

		return isAllies ? 'text-blue-400' : 'text-red-400';
	}

	watch(
		() => replay.messages,
		() => {
			translatedContents = null;
		}
	);
</script>

{#snippet message(message: FlatReplayMessage, index: number)}
	{@const key = messageKey(message, index)}
	{@const displayContent = translatedContents?.get(key) ?? message.content}
	<div
		class={cn(
			messageRow,
			flush ? 'border-secondary-800 border-b last:border-b-0' : 'rounded-md',
			messageTone(message)
		)}
	>
		<span class="text-secondary-500 pt-0.5 text-xs tabular-nums">{message.timestamp}</span>
		<span class="flex shrink-0 items-center gap-1.5 pt-0.5 font-semibold whitespace-nowrap">
			{#if message.recipient === 3}
				<ArrowBendDownLeft class="size-3.5 shrink-0" />
			{:else if message.recipient === 4}
				<ArrowBendUpRight class="size-3.5 shrink-0" />
			{/if}
			{message.sender}:
		</span>
		<span class="text-secondary-200 min-w-0 pt-0.5 wrap-break-word">{displayContent}</span>
	</div>
{/snippet}

<div
	{...restProps}
	class={cn('flex flex-col', flush ? '' : 'gap-2', restProps.class)}
>
	<div
		class={cn(
			'flex items-center gap-2',
			flush
				? 'border-secondary-800 border-b px-4 py-2.5'
				: 'border-secondary-800 bg-secondary-950/40 rounded-lg border px-4 py-3'
		)}
	>
		<input
			type="text"
			placeholder="en"
			aria-label={t('Target language')}
			bind:value={targetLanguage}
			disabled={translating}
			class={cn(controlBase, 'h-9 w-16 shrink-0 px-2 text-center text-sm', controlDisabled)}
		/>
		<Button
			size="sm"
			onclick={translateChat}
			loading={translating}
			disabled={translating || !targetLanguage.trim() || replay.messages.length === 0}
		>
			{t('Translate')}
		</Button>
		{#if translatedContents}
			<Button size="sm" variant="secondary" onclick={showOriginal} disabled={translating}>
				{t('Original')}
			</Button>
		{/if}
	</div>

	<div
		class={cn(
			'flex flex-col',
			flush
				? 'bg-secondary-950/50 max-h-128 overflow-auto'
				: 'border-secondary-800 bg-secondary-950/40 max-h-125 overflow-auto rounded-xl border px-2 py-2'
		)}
	>
		{#if replay.messages.length === 0}
			<p class="text-secondary-400 px-4 py-3 text-sm">{t('No messages')}</p>
		{/if}
		{#each replay.messages as m, i (m.playerID + '-' + i)}
			{@render message(m, i)}
		{/each}
	</div>
</div>
