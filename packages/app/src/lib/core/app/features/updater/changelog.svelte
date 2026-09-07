<script lang="ts">
	import { cn } from '$lib/utils';
	import ChangeLog from '../../../../../../../../CHANGELOG.md?raw';
	import { renderReleaseMarkdown } from './markdown';

	type Props = {
		markdown?: string;
	};

	let { markdown = ChangeLog }: Props = $props();

	let html = $derived(renderReleaseMarkdown(markdown));
</script>

<div
	class={cn(
		'prose prose-sm max-w-none p-4 text-secondary-200',
		'prose-headings:font-heading prose-headings:font-bold prose-headings:text-white',
		'prose-h2:text-secondary-200 prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-sm prose-h2:tracking-wider prose-h2:uppercase',
		'prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-base',
		'prose-strong:text-white prose-code:text-white',
		'prose-a:text-primary hover:prose-a:underline prose-a:cursor-pointer prose-a:no-underline',
		'prose-blockquote:border-secondary-700 prose-blockquote:text-primary',
		'prose-li:marker:text-secondary-400',
		'prose-img:ml-0 prose-img:h-auto prose-img:w-auto prose-img:max-w-full prose-img:rounded-md prose-img:object-contain',
		// What's New lead: first paragraph is the thematic summary for the release
		'[&>p:first-child]:mb-8 [&>p:first-child]:border-l-2 [&>p:first-child]:border-primary [&>p:first-child]:pl-4',
		'[&>p:first-child]:text-base [&>p:first-child]:leading-relaxed [&>p:first-child]:font-medium [&>p:first-child]:text-white'
	)}
>
	{@html html}
</div>
