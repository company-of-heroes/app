<script lang="ts">
	import { cn, interactive } from '$lib/cn';

	type Props = {
		href: string;
		variant?: 'primary' | 'secondary';
		class?: string;
		download?: string;
		children: import('svelte').Snippet;
	};

	let { href, variant = 'primary', class: className, download, children }: Props = $props();
</script>

<a
	{href}
	{download}
	target="_blank"
	rel="noopener noreferrer"
	class={cn(
		interactive,
		'inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors',
		variant === 'primary' &&
			'border-primary/30 bg-primary/10 text-primary-100 hover:bg-primary/20 hover:border-primary/50',
		variant === 'secondary' &&
			'border-secondary-700 bg-secondary-800/40 text-secondary-100 hover:bg-secondary-800/70 hover:border-secondary-600',
		className
	)}
>
	{@render children()}
</a>
