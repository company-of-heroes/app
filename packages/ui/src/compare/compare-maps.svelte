<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import { normalizeMapName } from '../format/player-format';
	import MapImage from '../ui/map-image.svelte';
	import CompareShare from './compare-share.svelte';
	import { useCompare } from './context';
	import { mirroredRow } from './format';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const context = useCompare();

	// Maps both sides have played, most games first.
	const rows = $derived.by(() => {
		const theirs = new Map(context.compare.them.performance.byMap.map((row) => [row.map, row]));
		return context.compare.me.performance.byMap
			.flatMap((mine) => {
				const other = theirs.get(mine.map);
				return other ? [{ map: mine.map, mine, theirs: other }] : [];
			})
			.map((row) => ({
				...row,
				games: row.mine.wins + row.mine.losses + row.theirs.wins + row.theirs.losses
			}))
			.sort((a, b) => b.games - a.games);
	});
</script>

{#if rows.length > 0}
	<section class={cn('border-secondary-800 border-b text-sm', className)}>
		<div class={cn(tableHeadRow, mirroredRow, 'py-2')}>
			<span class="truncate text-center">{t('You')}</span>
			<span class="truncate text-center">{t('By map')}</span>
			<span class="truncate text-center">{context.compare.them.alias}</span>
		</div>
		<!-- Rows close themselves; -mb-px lands the last line on the section's closing border. -->
		<div class="-mb-px">
			{#each rows as row (row.map)}
				<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
					<CompareShare record={row.mine} />
					<div class="flex min-w-0 items-center justify-center gap-2">
						<MapImage map={row.map} alt={normalizeMapName(row.map)} class="w-8" />
						<span class="min-w-0 truncate text-white">{normalizeMapName(row.map)}</span>
					</div>
					<CompareShare record={row.theirs} />
				</div>
			{/each}
		</div>
	</section>
{/if}
