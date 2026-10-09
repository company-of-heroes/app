<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { scoreClassName } from '../comment/vote';
	import { tooltip } from '../attachments';

	type Props = {
		likeCount?: number | null;
		showZero?: boolean;
		class?: string;
	};

	let { likeCount = null, showZero = false, class: className }: Props = $props();

	const count = $derived(likeCount == null ? null : Number(likeCount) || 0);
	const visible = $derived(count != null && (showZero || count !== 0));
	const label = $derived(count != null && count > 0 ? `+${count}` : String(count ?? 0));
</script>

{#if visible}
	<span
		class={cn(
			'shrink-0 text-xs font-semibold tabular-nums',
			scoreClassName(count ?? 0, 'text-secondary-400'),
			className
		)}
		{@attach tooltip('Player rating')}
	>
		{label}
	</span>
{/if}
