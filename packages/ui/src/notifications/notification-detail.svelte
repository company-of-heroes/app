<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import { renderMarkdown } from '../comment/markdown';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';

	type Props = {
		/** Markdown. */
		body: string;
		/** Website page the notification is about (e.g. a reported wiki page). */
		url?: string;
	};

	let { body, url }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// Sanitized: notification bodies are written by staff accounts, not trusted HTML.
	const html = $derived(renderMarkdown(body));
	const pageUrl = $derived(url?.startsWith('https://') ? url : undefined);

	function openPage(event: MouseEvent) {
		if (!pageUrl || !host.openExternal) {
			return;
		}

		event.preventDefault();
		host.openExternal(pageUrl);
	}
</script>

<div
	class={cn(
		'prose prose-sm text-secondary-200 max-w-none p-4',
		'prose-headings:text-white prose-strong:text-white prose-code:text-white',
		'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
		'prose-blockquote:border-secondary-700 prose-blockquote:text-primary',
		'prose-li:marker:text-secondary-400'
	)}
>
	{@html html}
</div>
{#if pageUrl}
	<div class="border-secondary-800 flex justify-end border-t px-4 py-3">
		<Button
			variant="secondary"
			size="sm"
			href={pageUrl}
			target="_blank"
			rel="noopener noreferrer"
			onclick={openPage}
		>
			<ArrowSquareOutIcon size={16} />
			{t('Open page')}
		</Button>
	</div>
{/if}
