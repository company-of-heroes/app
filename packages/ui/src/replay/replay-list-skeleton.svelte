<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';

	type Props = {
		rowCount?: number;
		mapLabel?: string;
		typeLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		durationLabel?: string;
		dateLabel?: string;
	};

	let {
		rowCount = 30,
		mapLabel = 'Map',
		typeLabel = 'Type',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		durationLabel = 'Duration',
		dateLabel = 'Date'
	}: Props = $props();

	const rows = $derived(Array.from({ length: rowCount }, (_, i) => i + 1));
</script>

{#snippet teamCell()}
	<td class="px-2 py-0 whitespace-nowrap">
		<div class="flex h-11 items-center gap-0">
			<Skeleton class="size-11 shrink-0 rounded-none" />
			<Skeleton class="size-11 shrink-0 rounded-none" />
		</div>
	</td>
{/snippet}

<div aria-busy="true">
	<div class="hidden overflow-x-auto md:block">
		<table class="w-full table-auto border-collapse text-sm">
			<thead class="border-secondary-800 border-b">
				<tr class="{tableHeadRow} text-left">
					<th class="w-full px-4 py-2">{mapLabel}</th>
					<th class="px-4 py-2 whitespace-nowrap">{typeLabel}</th>
					<th class="px-2 py-2 whitespace-nowrap">{alliesLabel}</th>
					<th class="px-2 py-2 whitespace-nowrap">{axisLabel}</th>
					<th class="px-4 py-2 whitespace-nowrap">{durationLabel}</th>
					<th class="px-4 py-2 whitespace-nowrap"></th>
					<th class="px-4 py-2 text-end whitespace-nowrap">{dateLabel}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row)}
					<tr class="border-secondary-800/70 h-11 border-t">
						<td class="w-full overflow-clip py-0 pr-0 pl-4">
							<div class="flex h-11 min-w-0 items-center gap-0">
								<Skeleton class="size-11 shrink-0 rounded-none" />
								<div class="flex min-w-0 items-center gap-2 px-4">
									<Skeleton class="h-3.5 w-32" />
								</div>
							</div>
						</td>
						<td class="px-4 py-0 whitespace-nowrap">
							<div class="flex h-11 items-center">
								<Skeleton class="h-3.5 w-14" />
							</div>
						</td>
						{@render teamCell()}
						{@render teamCell()}
						<td class="px-4 py-0 whitespace-nowrap">
							<div class="flex h-11 items-center">
								<Skeleton class="h-3.5 w-12" />
							</div>
						</td>
						<td class="px-4 py-0 whitespace-nowrap">
							<div class="flex h-11 items-center justify-end gap-2">
								<Skeleton class="h-3 w-6" />
								<Skeleton class="h-3 w-6" />
								<Skeleton class="h-3 w-6" />
							</div>
						</td>
						<td class="px-4 py-0 text-end whitespace-nowrap">
							<div class="flex h-11 items-center justify-end">
								<Skeleton class="h-3.5 w-24" />
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="divide-secondary-800 divide-y md:hidden">
		{#each rows as row (row)}
			<div class="px-4 py-3">
				<div class="flex h-11 min-w-0 items-center gap-0">
					<Skeleton class="size-11 shrink-0 rounded-none" />
					<div class="flex min-w-0 items-center gap-2 px-3">
						<Skeleton class="h-3.5 w-32" />
					</div>
				</div>
				<div class="mt-2 flex items-center gap-4">
					<div class="flex items-center gap-0">
						<Skeleton class="size-11 shrink-0 rounded-none" />
						<Skeleton class="size-11 shrink-0 rounded-none" />
					</div>
					<div class="flex items-center gap-0">
						<Skeleton class="size-11 shrink-0 rounded-none" />
						<Skeleton class="size-11 shrink-0 rounded-none" />
					</div>
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
					<Skeleton class="h-3.5 w-12" />
					<Skeleton class="h-3.5 w-12" />
					<Skeleton class="h-3.5 w-20" />
				</div>
				<div class="mt-1.5 flex items-center gap-2">
					<Skeleton class="h-3 w-6" />
					<Skeleton class="h-3 w-6" />
					<Skeleton class="h-3 w-6" />
				</div>
			</div>
		{/each}
	</div>
	<div class="border-secondary-800 flex border-t px-5 py-3">
		<Skeleton class="ms-auto h-9 w-40 sm:w-56" />
	</div>
</div>
