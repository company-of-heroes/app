<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { factionIcon, tableHeadRow } from '@company-of-heroes/ui/variants';

	type Props = {
		rowCount?: number;
		mapLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		durationLabel?: string;
		likesLabel?: string;
		commentsLabel?: string;
		downloadsLabel?: string;
		dateLabel?: string;
	};

	let {
		rowCount = 30,
		mapLabel = 'Map',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		durationLabel = 'Duration',
		likesLabel = 'Likes',
		commentsLabel = 'Comments',
		downloadsLabel = 'Downloads',
		dateLabel = 'Date'
	}: Props = $props();

	const rows = $derived(Array.from({ length: rowCount }, (_, i) => i + 1));
</script>

{#snippet countCell()}
	<td class="px-4 py-0">
		<span class="flex items-center justify-end gap-1.5">
			<Skeleton class="size-4 rounded" />
			<Skeleton class="h-4 w-6" />
		</span>
	</td>
{/snippet}

{#snippet teamCell()}
	<td class="px-4 py-0">
		<div class="flex items-center gap-2">
			<Skeleton class="{factionIcon} opacity-50" />
			<Skeleton class="{factionIcon} opacity-50" />
		</div>
	</td>
{/snippet}

<div aria-busy="true">
	<div class="overflow-x-auto">
		<table class="w-full table-fixed border-collapse text-sm">
			<thead class="border-secondary-800 border-b">
				<tr class="{tableHeadRow} text-left">
					<th class="w-6/24 px-4 py-2">{mapLabel}</th>
					<th class="w-3/24 px-4 py-2">{alliesLabel}</th>
					<th class="w-3/24 px-4 py-2">{axisLabel}</th>
					<th class="w-2/24 px-4 py-2">{durationLabel}</th>
					<th class="w-2/24 px-4 py-2 text-end">{likesLabel}</th>
					<th class="w-2/24 px-4 py-2 text-end">{commentsLabel}</th>
					<th class="w-2/24 px-4 py-2 text-end">{downloadsLabel}</th>
					<th class="w-4/24 px-4 py-2 text-end">{dateLabel}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row)}
					<tr class="border-secondary-800/70 h-11 border-t">
						<td class="overflow-clip py-0 pr-0 pl-4">
							<div class="flex h-11 min-w-0 items-center gap-0">
								<Skeleton class="size-11 shrink-0 rounded-none" />
								<div class="flex min-w-0 items-center gap-2 px-4">
									<Skeleton class="h-4 w-36" />
								</div>
							</div>
						</td>
						{@render teamCell()}
						{@render teamCell()}
						<td class="px-4 py-0"><Skeleton class="h-4 w-14" /></td>
						{@render countCell()}
						{@render countCell()}
						{@render countCell()}
						<td class="px-4 py-0">
							<Skeleton class="ml-auto h-4 w-28" />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="border-secondary-800 flex border-t px-5 py-3">
		<Skeleton class="ms-auto h-9 w-56" />
	</div>
</div>
