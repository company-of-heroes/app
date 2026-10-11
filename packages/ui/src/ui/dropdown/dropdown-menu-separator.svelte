<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { dropdownSeparator } from '../../variants';

	type Props = DropdownMenu.SeparatorProps;

	let { ref = $bindable(null), class: className, ...restProps }: Props = $props();
</script>

<DropdownMenu.Separator {...restProps} bind:ref class={cn(dropdownSeparator, className)} />
