<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { getEloColor, getEloTextShadow, isEliteElo } from '../format/player-format';
	import { tooltip } from '../attachments';

	type Props = {
		/** Nothing renders without a stored ELO. */
		elo: number | null;
		class?: string;
	};

	const { t } = useI18n();

	let { elo, class: className }: Props = $props();
</script>

{#if elo !== null}
	<span
		class={cn(
			'border-secondary-800 bg-secondary-950/70 inline-flex h-5 shrink-0 items-center gap-1 rounded border px-1.5 text-xs tabular-nums',
			isEliteElo(elo) ? 'font-bold tracking-wide' : 'font-semibold',
			className
		)}
		style:color={getEloColor(elo)}
		style:text-shadow={getEloTextShadow(elo)}
		{@attach tooltip(t('Companion ELO from recorded matches'))}
	>
		{elo}
	</span>
{/if}
