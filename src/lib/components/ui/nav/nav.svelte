<script lang="ts">
	import { cn } from '$lib/utils';

	let { children, ...restProps } = $props();
</script>

<nav {...restProps} class={cn('flex flex-col gap-1', restProps.class)}>
	{@render children()}
</nav>
