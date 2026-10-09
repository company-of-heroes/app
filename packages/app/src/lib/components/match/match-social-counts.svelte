<script lang="ts">
	import { useMatch } from '.';
	import { scoreClassName } from '@company-of-heroes/ui/comment';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import { tooltip } from '$lib/attachments';

	const match = useMatch();
	const { t } = useI18n();
	const likeCount = $derived(match.likeCount ?? 0);
	const downloadCount = $derived(match.downloadCount ?? 0);
	const showDownload = $derived(!!(match.hasReplay || match.replay));
</script>

<div class="text-secondary-400 flex items-center justify-end gap-3 text-sm tabular-nums">
	<span
		class={cn('inline-flex items-center gap-1.5', scoreClassName(likeCount, 'text-secondary-400'))}
		{@attach tooltip(t('Likes'))}
	>
		<CaretUpIcon size={16} weight="fill" />
		{likeCount}
	</span>
	{#if showDownload}
		<span class="inline-flex items-center gap-1.5" {@attach tooltip(t('Downloads'))}>
			<DownloadIcon size={16} weight="duotone" />
			{downloadCount}
		</span>
	{/if}
</div>
