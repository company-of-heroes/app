<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, tableHeadRow } from '@company-of-heroes/ui/variants';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import CompareShare from './compare-share.svelte';
	import { useCompare } from './context';
	import { mirroredRow } from './format';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const context = useCompare();

	const rows = $derived(
		[0, 1, 2, 3].map((raceId) => {
			const mine = context.compare.me.performance.byFaction.find((row) => row.raceId === raceId);
			const theirs = context.compare.them.performance.byFaction.find(
				(row) => row.raceId === raceId
			);
			return { raceId, mine, theirs };
		})
	);
</script>

<section class={cn('border-secondary-800 border-b text-sm', className)}>
	<div class={cn(tableHeadRow, mirroredRow, 'py-2')}>
		<span class="truncate text-center">{t('You')}</span>
		<span class="truncate text-center">{t('By faction')}</span>
		<span class="truncate text-center">{context.compare.them.alias}</span>
	</div>
	<!-- Rows close themselves; -mb-px lands the last line on the section's closing border. -->
	<div class="-mb-px">
		{#each rows as row (row.raceId)}
			<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
				<CompareShare record={row.mine} />
				<div class="flex min-w-0 items-center justify-center gap-2">
					<img src={host.resolve.factionFlagByRace(row.raceId)} alt="" class={factionIcon} />
					<span class="min-w-0 truncate text-white">{getRaceLabel(row.raceId)}</span>
				</div>
				<CompareShare record={row.theirs} />
			</div>
		{/each}
	</div>
</section>
