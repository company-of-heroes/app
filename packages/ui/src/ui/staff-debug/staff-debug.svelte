<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { Badge } from '@company-of-heroes/ui/badge';
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';

	type Props = {
		staffOnlyLabel?: string;
		description?: string;
		children: Snippet;
	} & HTMLAttributes<HTMLElement>;

	const { t } = useI18n();
	let {
		staffOnlyLabel = t('Staff only'),
		description,
		children,
		class: className,
		...restProps
	}: Props = $props();
</script>

<section
	{...restProps}
	class={cn('border-primary/20 bg-primary/5 overflow-clip border-t', className)}
>
	<div class="border-primary/20 flex flex-wrap items-center gap-2 border-b px-6 py-2.5">
		<Badge variant="warning">{staffOnlyLabel}</Badge>
		{#if description}
			<p class="text-warning text-xs">{description}</p>
		{/if}
	</div>
	<div class="px-6 py-4">
		{@render children()}
	</div>
</section>
