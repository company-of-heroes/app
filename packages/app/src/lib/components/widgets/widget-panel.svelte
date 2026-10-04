<script lang="ts">
	import type { Snippet } from 'svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import { H } from '$lib/components/ui/h';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { useI18n } from '$lib/i18n';

	type Props = {
		title: string;
		summary?: string;
		trailing?: Snippet;
		children: Snippet;
	};

	let { title, summary, trailing, children }: Props = $props();
	const { t } = useI18n();
	let expanded = $state(true);

	function toggle() {
		expanded = !expanded;
	}
</script>

<div class="border-secondary-900 overflow-clip border-b">
	<div class={cn('flex items-center gap-3', expanded && 'border-secondary-800 border-b')}>
		<button
			type="button"
			class={cn(
				interactive,
				'flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left'
			)}
			aria-expanded={expanded}
			onclick={toggle}
		>
			<H level="6" class="mb-0 font-semibold">{title}</H>
			{#if summary}
				<span class="text-secondary-400 text-sm tabular-nums">{summary}</span>
			{/if}
		</button>
		{#if trailing}
			<div class="shrink-0">{@render trailing()}</div>
		{/if}
		<button
			type="button"
			class={cn(interactive, 'text-secondary-400 hover:text-primary shrink-0 px-4 py-3')}
			aria-expanded={expanded}
			aria-label={expanded ? t('Collapse panel') : t('Expand panel')}
			onclick={toggle}
		>
			<CaretDownIcon class={cn('size-4 transition-transform', expanded && 'rotate-180')} />
		</button>
	</div>
	{#if expanded}
		{@render children()}
	{/if}
</div>
