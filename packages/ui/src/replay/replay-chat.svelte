<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { watch } from 'runed';
	import ArrowBendDownLeftIcon from 'phosphor-svelte/lib/ArrowBendDownLeftIcon';
	import ArrowBendUpRightIcon from 'phosphor-svelte/lib/ArrowBendUpRightIcon';
	import { tryUseHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { controlBase, controlDisabled, mePlayerText } from '../variants';
	import type { ReplayMessage } from './types';

	type Props = {
		messages: ReplayMessage[];
		playerCount: number;
		class?: string;
	};

	let { messages, playerCount, class: className }: Props = $props();
	const { t } = useI18n();
	const host = tryUseHost();
	const translate = host?.api.translate;

	let targetLanguage = $state('en');
	let translated = $state<Map<string, string> | null>(null);
	let translating = $state(false);

	const messageRow =
		'grid grid-cols-[3.75rem_minmax(0,auto)_1fr] sm:grid-cols-[4.5rem_minmax(0,auto)_1fr] items-start gap-x-2 sm:gap-x-3 gap-y-0.5 px-4 py-2.5 border-secondary-800 border-b last:border-b-0';

	function messageKey(message: ReplayMessage, index: number) {
		return `${message.playerID}-${index}`;
	}

	function messageTone(message: ReplayMessage) {
		if (message.sender === 'System') {
			return 'text-secondary-400';
		}

		if (host?.auth.isSelfAlias(message.sender)) {
			return mePlayerText;
		}

		if (message.recipient === 0) {
			return 'text-primary';
		}

		if (message.recipient === 3 || message.recipient === 4) {
			return 'text-primary-50';
		}

		const isAllies =
			(playerCount === 8 && message.playerID < 1004) ||
			(playerCount === 6 && message.playerID < 1003) ||
			(playerCount === 4 && message.playerID < 1002) ||
			(playerCount === 2 && message.playerID < 1001);
		return isAllies ? 'text-blue-400' : 'text-red-400';
	}

	async function translateChat() {
		const language = targetLanguage.trim();
		if (!translate || !language || messages.length === 0) {
			return;
		}

		translating = true;
		try {
			const entries = await Promise.all(
				messages.map(
					async (message, index) =>
						[messageKey(message, index), await translate(message.content, language)] as const
				)
			);
			translated = new Map(entries);
		} catch {
			host?.notify.error(t('Translation failed'));
		} finally {
			translating = false;
		}
	}

	watch(
		() => messages,
		() => {
			translated = null;
		}
	);
</script>

<div class={cn('flex flex-col', className)}>
	{#if translate}
		<div class="border-secondary-800 flex items-center gap-2 border-b px-4 py-2.5">
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
				disabled={translating || !targetLanguage.trim() || messages.length === 0}
			>
				{t('Translate')}
			</Button>
			{#if translated}
				<Button
					size="sm"
					variant="secondary"
					onclick={() => (translated = null)}
					disabled={translating}
				>
					{t('Original')}
				</Button>
			{/if}
		</div>
	{/if}
	<div class="bg-secondary-950/50 max-h-[32rem] overflow-auto">
		{#if messages.length === 0}
			<p class="text-secondary-400 px-4 py-3 text-sm">{t('No messages')}</p>
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
				<span class="text-secondary-200 min-w-0 pt-0.5 wrap-break-word">
					{translated?.get(messageKey(message, i)) ?? message.content}
				</span>
			</div>
		{/each}
	</div>
</div>
