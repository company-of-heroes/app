<script lang="ts">
	import { cn, interactive } from '$lib/cn';
	import { navigate } from '$lib/router.svelte';

	type Props = {
		href: string;
		class?: string;
		children: import('svelte').Snippet;
	};

	let { href, class: className, children }: Props = $props();

	function handleClick(event: MouseEvent) {
		if (
			href.startsWith('/') &&
			!href.startsWith('//') &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			event.button === 0
		) {
			event.preventDefault();
			navigate(href);
		}
	}
</script>

<a {href} onclick={handleClick} class={cn(interactive, className)}>
	{@render children()}
</a>
