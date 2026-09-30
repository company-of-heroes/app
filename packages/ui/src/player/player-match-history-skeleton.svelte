<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';

	type Props = {
		matchCount?: number;
		playersPerMatch?: number;
	};

	let { matchCount = 4, playersPerMatch = 2 }: Props = $props();
	const { t } = useI18n();

	const matches = $derived(Array.from({ length: matchCount }, (_, i) => i + 1));
	const players = $derived(Array.from({ length: playersPerMatch }, (_, i) => i + 1));
</script>

{#snippet playerRow()}
	<tr class="border-secondary-800 h-9 border-b">
		<td class="px-2 py-1.5">
			<div class="flex w-full justify-center">
				<Skeleton class="h-3.5 w-8" />
			</div>
		</td>
		<td class="px-2 py-1.5">
			<div class="flex w-full justify-center">
				<Skeleton class="h-3.5 w-10" />
			</div>
		</td>
		<td class="px-2 py-1.5">
			<div class="flex w-full items-center justify-center gap-2">
				<Skeleton class="size-6 shrink-0" />
				<Skeleton class="h-3.5 w-4" />
			</div>
		</td>
		<td class="px-2 py-1.5">
			<div class="flex w-full justify-center">
				<Skeleton class="h-6 w-6 shrink-0" />
			</div>
		</td>
		<td class="px-3 py-1.5">
			<div class="flex min-w-0 items-center gap-2">
				<Skeleton class="size-8 shrink-0 rounded-lg" />
				<Skeleton class="size-5 shrink-0 rounded-full" />
				<Skeleton class="h-3.5 w-28 max-w-full" />
			</div>
		</td>
		<td class="px-2 py-1.5">
			<div class="flex w-full justify-center">
				<Skeleton class="h-3.5 w-8" />
			</div>
		</td>
		<td class="px-2 py-1.5">
			<div class="flex w-full justify-center">
				<Skeleton class="h-3.5 w-8" />
			</div>
		</td>
		<td class="px-2 py-1.5">
			<div class="flex w-full justify-center">
				<Skeleton class="h-3.5 w-8" />
			</div>
		</td>
	</tr>
{/snippet}

<div aria-busy="true">
	{#each matches as match (match)}
		<section class="border-secondary-800 border-b">
			<div
				class="border-secondary-800 flex min-w-0 flex-wrap items-center gap-4 border-b px-4 py-2"
			>
				<Skeleton class="size-10 shrink-0 rounded-none" />
				<div class="min-w-0 grow space-y-1.5">
					<Skeleton class="h-5 w-44 max-w-full" />
					<Skeleton class="h-3.5 w-52 max-w-full" />
				</div>
				<div class="flex shrink-0 items-center gap-4">
					<Skeleton class="h-8 w-28 rounded-md" />
					<Skeleton class="h-4 w-14" />
				</div>
			</div>
			<div class="hidden overflow-x-auto md:block">
				<table class="w-full table-fixed text-sm">
					<colgroup>
						<col class="w-14" />
						<col class="w-14" />
						<col class="w-[4.5rem]" />
						<col class="w-12" />
						<col />
						<col class="w-14" />
						<col class="w-14" />
						<col class="w-14" />
					</colgroup>
					<thead>
						<tr class={tableHeadRow}>
							<th class="px-2 py-2 text-center">{t('Change')}</th>
							<th class="px-2 py-2 text-center">{t('ELO')}</th>
							<th class="px-2 py-2 text-center">{t('Rank')}</th>
							<th class="px-2 py-2 text-center">{t('Team')}</th>
							<th class="px-3 py-2 text-left">{t('Player')}</th>
							<th class="px-2 py-2 text-center">{t('Wins')}</th>
							<th class="px-2 py-2 text-center">{t('Losses')}</th>
							<th class="px-2 py-2 text-center">{t('Streak')}</th>
						</tr>
					</thead>
					<tbody>
						{#each players as player (player)}
							{@render playerRow()}
						{/each}
					</tbody>
				</table>
			</div>
			<div class="divide-secondary-800 divide-y md:hidden">
				{#each players as player (player)}
					<div class="space-y-2 px-4 py-3">
						<div class="flex min-w-0 items-center gap-2">
							<Skeleton class="size-8 shrink-0 rounded-lg" />
							<Skeleton class="size-5 shrink-0 rounded-full" />
							<Skeleton class="h-3.5 w-28 max-w-full" />
						</div>
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
							<Skeleton class="h-3.5 w-8" />
							<Skeleton class="h-3.5 w-10" />
							<Skeleton class="size-6 shrink-0" />
							<Skeleton class="h-6 w-6 shrink-0" />
							<Skeleton class="h-3.5 w-8" />
							<Skeleton class="h-3.5 w-8" />
							<Skeleton class="h-3.5 w-8" />
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
