<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';

	type Props = {
		title: string;
		description?: string;
		/** "View all" target. */
		href?: string;
		class?: string;
	};

	const { t } = useI18n();

	let { title, description, href, class: className }: Props = $props();
</script>

<div
	class={cn(
		'border-secondary-800 bg-secondary-900/70 flex items-center justify-between gap-4 border-b px-4 py-3 shadow-[inset_3px_0_0_var(--color-primary)]',
		className
	)}
>
	<div class="min-w-0">
		<h2 class="font-heading truncate text-lg font-bold text-white">{title}</h2>
		{#if description}
			<p class="text-secondary-400 truncate text-sm">{description}</p>
		{/if}
	</div>
	{#if href}
		<a
			{href}
			class={cn(
				interactive,
				'text-secondary-300 hover:text-primary group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors'
			)}
		>
			{t('View all')}
			<ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
		</a>
	{/if}
</div>
