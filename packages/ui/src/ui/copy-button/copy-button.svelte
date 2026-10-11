<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { tooltip } from '../../attachments/tooltip.svelte';

	type Props = {
		/** Text written to the clipboard. */
		value: string;
		/** Tooltip and aria-label; defaults to "Copy". */
		label?: string;
		size?: number;
	} & Omit<HTMLButtonAttributes, 'value'>;

	let { value, label, size = 14, class: className, ...restProps }: Props = $props();
	const { t } = useI18n();

	let copied = $state(false);
	let timeout: ReturnType<typeof setTimeout> | undefined;

	async function copy(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			return;
		}

		copied = true;
		clearTimeout(timeout);
		timeout = setTimeout(() => (copied = false), 1500);
	}

	onDestroy(() => clearTimeout(timeout));
</script>

<button
	type="button"
	{...restProps}
	aria-label={label ?? t('Copy')}
	class={cn(
		interactive,
		'text-secondary-400 inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 transition-colors hover:text-white',
		copied && 'text-success hover:text-success',
		className
	)}
	onclick={copy}
	{@attach tooltip(label ?? t('Copy'))}
>
	{#if copied}
		<CheckIcon {size} weight="bold" />
	{:else}
		<CopyIcon {size} />
	{/if}
</button>
