<script lang="ts">
	import { cn } from '$lib/utils';
	import { Checkbox, Label, useId, type WithoutChildrenOrChild } from 'bits-ui';
	import CheckIcon from 'phosphor-svelte/lib/Check';

	let {
		id = useId(),
		checked = $bindable(false),
		ref = $bindable(null),
		label,
		...restProps
	}: WithoutChildrenOrChild<Checkbox.RootProps> & {
		label: string;
	} = $props();
</script>

<div class="flex items-center gap-4">
	<Checkbox.Root
		bind:checked
		bind:ref
		{...restProps}
		class={cn(
			'border-secondary-900 flex size-7 items-center justify-center overflow-clip rounded-md border'
		)}
		{id}
	>
		{#snippet children({ checked, indeterminate })}
			{#if checked}
				<span class="bg-secondary-900 flex h-full w-full items-center justify-center text-white">
					{#if indeterminate}
						-
					{:else if checked}
						<CheckIcon weight="bold" />
					{/if}
				</span>
			{/if}
		{/snippet}
	</Checkbox.Root>
	<Label.Root for={id}>
		{label}
	</Label.Root>
</div>
