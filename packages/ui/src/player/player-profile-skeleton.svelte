<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';

	const { t } = useI18n();
</script>

<div class="border-secondary-800 overflow-clip border-b" aria-busy="true">
	<div class="border-secondary-800 border-b">
		<div class="flex flex-col gap-5 px-4 pt-6 pb-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="flex min-w-0 items-end gap-4 sm:gap-5">
				<Skeleton class="size-20 shrink-0 rounded-md sm:size-28" />
				<div class="flex min-w-0 flex-col gap-2">
					<div class="flex items-center gap-2">
						<Skeleton class="h-4 w-6 rounded-xs" />
						<Skeleton class="h-5 w-14 rounded-md" />
					</div>
					<Skeleton class="h-9 w-56 max-w-full" />
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Skeleton class="h-8 w-28 rounded-md" />
				<Skeleton class="h-8 w-32 rounded-md" />
			</div>
		</div>
	</div>
	<div class="overflow-hidden">
		<div class="-mr-px flex flex-wrap">
			{#each Array(4) as _, index (index)}
				<div
					class="border-secondary-800 flex min-w-40 flex-1 basis-44 flex-col gap-2 border-r border-b px-4 py-3"
				>
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-6 w-24" />
				</div>
			{/each}
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
							<th class="w-[6.5rem] px-4 py-2">{t('ELO')}</th>
							<th class="w-[8rem] px-4 py-2">{t('Level')}</th>
							<th class="w-[14rem] px-4 py-2">{t('Type')}</th>
							<th class="w-[6.5rem] px-4 py-2">{t('Position')}</th>
							<th class="w-[5.5rem] px-4 py-2">{t('Wins')}</th>
							<th class="w-[6rem] px-4 py-2">{t('Losses')}</th>
							<th class="w-[6rem] px-4 py-2">{t('Streak')}</th>
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
