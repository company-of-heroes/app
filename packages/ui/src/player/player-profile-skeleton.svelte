<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
</script>

<div class="border-secondary-800 overflow-clip border-b" aria-busy="true">
	<div class="border-secondary-800 grid grid-cols-1 border-b sm:grid-cols-[12.5rem_minmax(0,1fr)]">
		<Skeleton class="aspect-square self-start rounded-none" />
		<div class="min-w-0 px-6 py-4">
			<div class="mb-3 flex items-center gap-2.5">
				<Skeleton class="h-5 w-7 shrink-0 rounded-xs" />
				<Skeleton class="h-9 max-w-52 flex-1" />
				<Skeleton class="h-4 w-16 shrink-0" />
			</div>
			<div class="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
				<Skeleton class="h-4 w-16" />
				<Skeleton class="h-4 w-36" />
				<Skeleton class="h-4 w-14" />
				<Skeleton class="h-4 w-28" />
				<Skeleton class="h-4 w-16" />
				<div class="flex items-center gap-2">
					<Skeleton class="h-4 w-8" />
					<Skeleton class="h-4 w-8" />
					<Skeleton class="h-5 w-12 rounded-full" />
				</div>
				<Skeleton class="h-4 w-16" />
				<div class="flex gap-1 overflow-hidden">
					{#each Array(10) as _, index (index)}
						<Skeleton class="min-w-6 h-6 shrink-0 rounded-md" />
					{/each}
				</div>
				<Skeleton class="h-4 w-20" />
				<div class="flex items-center gap-2">
					<Skeleton class="size-10 shrink-0 rounded" />
					<Skeleton class="h-4 w-32" />
					<Skeleton class="h-4 w-8" />
					<Skeleton class="h-4 w-8" />
				</div>
			</div>
		</div>
	</div>
	<div class="border-secondary-800 border-b">
		<div class="flex min-w-0 flex-wrap items-center gap-2 px-4 py-2.5">
			<Skeleton class="h-8 w-14 rounded-md" />
			<Skeleton class="h-8 w-24 rounded-md" />
			<Skeleton class="h-8 w-28 rounded-md" />
		</div>
		<div class="border-secondary-800 border-t">
			<div class="hidden overflow-x-auto md:block">
				<table class="w-full table-fixed border-collapse text-sm">
					<thead>
						<tr class="{tableHeadRow} text-center">
							<th class="w-[6.5rem] px-4 py-2">ELO</th>
							<th class="w-[8rem] px-4 py-2">Level</th>
							<th class="w-[14rem] px-4 py-2">Type</th>
							<th class="w-[6.5rem] px-4 py-2">Position</th>
							<th class="w-[5.5rem] px-4 py-2">Wins</th>
							<th class="w-[6rem] px-4 py-2">Losses</th>
							<th class="w-[6rem] px-4 py-2">Streak</th>
						</tr>
					</thead>
					<tbody>
						{#each Array(8) as _, index (index)}
							<tr class="border-secondary-800/70 h-11 border-t">
								<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-12" /></td>
								<td class="px-4 py-1.5">
									<div class="flex items-center justify-center gap-2">
										<Skeleton class="size-6 shrink-0" />
										<Skeleton class="h-4 w-6" />
									</div>
								</td>
								<td class="px-4 py-1.5">
									<div class="flex items-center justify-center gap-2">
										<Skeleton class="h-4 w-6" />
										<Skeleton class="h-4 w-16" />
									</div>
								</td>
								<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
								<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
								<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
								<td class="px-4 py-1.5"><Skeleton class="mx-auto h-4 w-8" /></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="divide-secondary-800 divide-y md:hidden">
				{#each Array(8) as _, index (index)}
					<div class="flex flex-col gap-2 px-4 py-3">
						<div class="flex items-center gap-3">
							<Skeleton class="h-4 w-6 shrink-0" />
							<Skeleton class="h-4 w-28 grow" />
							<Skeleton class="h-4 w-10" />
							<Skeleton class="h-4 w-8" />
						</div>
						<div class="flex flex-wrap gap-2">
							<Skeleton class="h-6 w-12 rounded-full" />
							<Skeleton class="h-6 w-12 rounded-full" />
							<Skeleton class="h-6 w-12 rounded-full" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
	<div class="bg-secondary-800/20 flex flex-wrap gap-x-4 gap-y-1 px-4 py-3">
		<Skeleton class="h-4 w-36" />
		<Skeleton class="h-4 w-28" />
		<Skeleton class="h-4 w-32" />
	</div>
</div>
