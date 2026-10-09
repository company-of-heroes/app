<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import ShieldCheckIcon from 'phosphor-svelte/lib/ShieldCheckIcon';
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';

	type Props = {
		title?: string;
		description?: string;
		/** Extra classes for the content area under the title. */
		contentClass?: string;
		children: Snippet;
	} & HTMLAttributes<HTMLElement>;

	const { t } = useI18n();
	let {
		title = t('Staff'),
		description,
		contentClass,
		children,
		class: className,
		...restProps
	}: Props = $props();
</script>

<section
	{...restProps}
	class={cn('border-secondary-800 bg-primary/10 overflow-clip border-t', className)}
>
	<div class="border-primary/10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2">
		<span
			class="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"
		>
			<ShieldCheckIcon size={14} weight="fill" />
			{title}
		</span>
		{#if description}
			<p class="text-primary-200/80 text-xs">{description}</p>
		{/if}
	</div>
	<div class={cn('px-4 py-3', contentClass)}>
		{@render children()}
	</div>
</section>
