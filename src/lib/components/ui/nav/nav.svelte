<script lang="ts">
	import { cn } from '$lib/utils';

	let { children, ...restProps } = $props();
</script>

<nav {...restProps} class={cn('flex flex-col', restProps.class)}>
	{@render children()}
</nav>
