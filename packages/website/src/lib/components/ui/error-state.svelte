<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { interactive } from '$lib/utils/variants';

	type Props = {
		title: string;
		message: string;
		href?: string;
		linkLabel?: string;
	};

	let { title, message, href, linkLabel }: Props = $props();
</script>

<div class="border-secondary-800 border-b px-4 py-3">
	<h1 class="font-heading mb-1 text-xl font-bold text-white">{title}</h1>
	<p class="text-secondary-400 text-sm">{message}</p>
	{#if href && linkLabel}
		<p class="mt-2">
			<a {href} class={cn(interactive, 'text-primary text-sm hover:underline')}>{linkLabel}</a>
		</p>
	{/if}
</div>
