<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';

	const podiumRanks = [2, 1, 3];
	const rows = [4, 5, 6, 7, 8, 9, 10, 11];
</script>

<div aria-busy="true">
	<div
		class="border-secondary-800 grid grid-cols-1 border-b sm:grid-cols-3 sm:divide-x sm:divide-secondary-800"
	>
		{#each podiumRanks as rank (rank)}
			<div
				class="flex min-w-0 flex-col items-center gap-2 px-4 py-5 {rank === 1
					? 'bg-primary/5 sm:py-6'
					: ''}"
			>
				<Skeleton class="h-5 w-8" />
				<Skeleton class="rounded-xl {rank === 1 ? 'size-16' : 'size-14'}" />
				<Skeleton class="h-5 w-28" />
				<Skeleton class="h-4 w-36" />
			</div>
		{/each}
	</div>
	<div class="hidden overflow-x-auto md:block">
		<table class="w-full table-fixed border-collapse text-sm">
			<thead>
				<tr class="{tableHeadRow} text-center">
					<th class="w-14 px-4 py-2">#</th>
					<th class="w-26 px-4 py-2">Rank</th>
					<th class="px-4 py-2 text-left">Alias</th>
					<th class="w-22 px-4 py-2">ELO</th>
					<th class="w-20 px-4 py-2">Wins</th>
					<th class="w-22 px-4 py-2">Losses</th>
					<th class="w-22 px-4 py-2">Streak</th>
					<th class="w-22 px-4 py-2">Ratio</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row)}
					<tr class="border-secondary-800/70 h-11 border-t">
						<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-6" /></td>
						<td class="px-4 py-1.5">
							<div class="flex items-center justify-center gap-2">
								<Skeleton class="size-6 shrink-0 rounded" />
								<Skeleton class="h-4 w-6" />
							</div>
						</td>
						<td class="px-4 py-1.5">
							<div class="flex items-center gap-2">
								<Skeleton class="h-4 w-6 shrink-0 rounded-xs" />
								<Skeleton class="h-4 w-32" />
							</div>
						</td>
						<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-10" /></td>
						<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
						<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
						<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
						<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-10" /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="divide-secondary-800 divide-y md:hidden">
		{#each rows as row (row)}
			<div class="flex flex-col gap-2 px-4 py-3">
				<div class="flex items-center gap-3">
					<Skeleton class="h-4 w-6" />
					<Skeleton class="size-6 shrink-0 rounded" />
					<Skeleton class="h-4 w-28 grow" />
					<Skeleton class="h-4 w-10" />
				</div>
				<div class="flex flex-wrap gap-3">
					<Skeleton class="h-3.5 w-12" />
					<Skeleton class="h-3.5 w-12" />
					<Skeleton class="h-3.5 w-12" />
					<Skeleton class="h-3.5 w-12" />
				</div>
			</div>
		{/each}
	</div>
</div>
