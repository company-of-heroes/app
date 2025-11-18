<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ContextMenu } from 'bits-ui';

	type Props = ContextMenu.RootProps & {
		trigger: Snippet<[{ props: ContextMenu.TriggerProps }]>;
	};

	let { children, trigger, ...restProps }: Props = $props();
</script>

<ContextMenu.Root {...restProps}>
	<ContextMenu.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content>
			{@render children?.()}
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
