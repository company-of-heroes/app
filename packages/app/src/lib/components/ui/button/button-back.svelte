<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeftIcon';
	import { useI18n } from '$lib/i18n';

	type Props = {
		href?: string;
		useHistory?: boolean;
		iconOnly?: boolean;
	} & HTMLButtonAttributes;

	let {
		href,
		useHistory = false,
		iconOnly = false,
		children,
		onclick,
		class: className,
		...restProps
	}: Props = $props();
	const { t } = useI18n();

	function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (onclick) {
			onclick(event);
			return;
		}

		if (useHistory && window.history.length > 1) {
			history.back();
			return;
		}

		void goto(href ?? '/');
	}
</script>

<button
	type="button"
	onclick={handleClick}
	{...restProps}
	class={cn(
		interactive,
		iconOnly
			? 'border-secondary-600 bg-secondary-800 hover:border-secondary-500 hover:bg-secondary-700 inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors'
			: 'mb-6 inline-flex items-center gap-2 text-xl transition-transform hover:-translate-x-0.5',
		className
	)}
>
	<ArrowLeft weight="duotone" class={iconOnly ? 'size-4' : undefined} />
	{#if !iconOnly}
		{#if children}
			{@render children()}
		{:else}
			{t('Back to previous page')}
		{/if}
	{/if}
</button>
