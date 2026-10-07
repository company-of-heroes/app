<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { useHost } from '../host/host.context';

	type Props = {
		/** Icon key (`units_unit_allied_rifleman`). */
		icon?: string;
		/** Shown as a letter when there is no icon. */
		name: string;
		class?: string;
	};

	let { icon, name, class: className }: Props = $props();
	const host = useHost();

	const src = $derived(icon ? host.resolve.actionIcon(icon) : undefined);
</script>

{#if src}
	<img
		{src}
		alt=""
		loading="lazy"
		class={cn('size-10 shrink-0 rounded-sm object-contain', className)}
	/>
{:else}
	<span
		aria-hidden="true"
		class={cn(
			'bg-secondary-900 text-secondary-400 flex size-10 shrink-0 items-center justify-center rounded-sm text-sm font-bold',
			className
		)}
	>
		{name.charAt(0)}
	</span>
{/if}
