<script lang="ts">
	import { openUrl } from '@tauri-apps/plugin-opener';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { renderMarkdown } from '$lib/utils/markdown';

	type Props = {
		body: string;
		/** Website page the notification is about (e.g. a reported wiki page). */
		url?: string;
	};

	let { body, url }: Props = $props();
	const { t } = useI18n();

	// Sanitized: notification bodies are written by staff accounts, not trusted HTML.
	const html = $derived(renderMarkdown(body));
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
{#if url?.startsWith('https://')}
	<div class="border-secondary-800 flex justify-end border-t px-4 py-3">
		<Button variant="secondary" size="sm" onclick={() => void openUrl(url)}>
			<ArrowSquareOutIcon size={16} />
			{t('Open page')}
		</Button>
	</div>
{/if}
