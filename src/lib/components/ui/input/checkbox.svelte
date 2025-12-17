<script lang="ts">
	import { cn } from '$lib/utils';
	import { Checkbox, Label, useId, type WithoutChildrenOrChild } from 'bits-ui';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import MinusIcon from 'phosphor-svelte/lib/Minus';

	let {
		id = useId(),
		checked = $bindable(false),
		// @ts-ignore
		indeterminate = $bindable(null),
		ref = $bindable(null),
		label,
		...restProps
	}: WithoutChildrenOrChild<Checkbox.RootProps> & {
		label: string;
	} = $props();

	function getChecked() {
		return checked;
	}

	function setChecked(value: boolean) {
		if (indeterminate === null) {
			checked = value;
			return;
		}

		if (indeterminate) {
			checked = false;
			indeterminate = false;
		} else if (checked) {
			checked = false;
			indeterminate = true;
		} else {
			checked = true;
			indeterminate = false;
		}
	}
</script>

<div class="flex items-center gap-4">
	<Checkbox.Root
		bind:checked={getChecked, setChecked}
		{indeterminate}
		bind:ref
		{...restProps}
		class={cn(
			'border-secondary-900 flex size-7 items-center justify-center overflow-clip rounded-md border',
			restProps.class
		)}
		{id}
	>
		{#snippet children({ checked, indeterminate })}
			{#if indeterminate || checked}
				<span class="bg-secondary-900 flex h-full w-full items-center justify-center text-white">
					{#if indeterminate}
						<MinusIcon weight="bold" />
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
