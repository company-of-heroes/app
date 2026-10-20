<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';

	type Props = {
		matchCount?: number;
		playersPerMatch?: number;
	};

	let { matchCount = 4, playersPerMatch = 2 }: Props = $props();
	const { t } = useI18n();

	/** Mirrors the grid in `player-match-history.svelte`. */
	const grid =
		'grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 md:grid-cols-[3.5rem_3.5rem_3.5rem_3.5rem_2.5rem_minmax(0,1fr)_4rem_3.5rem_3.5rem_4.5rem_4rem]';

	const matches = $derived(Array.from({ length: matchCount }, (_, i) => i + 1));
	const players = $derived(Array.from({ length: playersPerMatch }, (_, i) => i + 1));
</script>

{#snippet playerRow()}
	<div class={cn(grid, 'border-secondary-800/70 min-h-12 border-b py-2')}>
		<Skeleton class="h-4 w-8" />
		<Skeleton class="h-4 w-6 max-md:hidden" />
		<div class="flex justify-center gap-1.5 max-md:hidden">
			<Skeleton class="size-6 shrink-0" />
			<Skeleton class="h-4 w-4" />
		</div>
		<div class="flex justify-center max-md:hidden"><Skeleton class="h-5 w-10" /></div>
		<div class="flex justify-center max-md:hidden"><Skeleton class="size-6" /></div>
		<div class="flex min-w-0 items-center gap-2">
			<Skeleton class="size-8 shrink-0 rounded-lg" />
			<Skeleton class="size-5 shrink-0 rounded-full" />
			<Skeleton class="h-3.5 w-28 max-w-full" />
		</div>
		<div class="flex justify-center max-md:hidden"><Skeleton class="h-4 w-8" /></div>
		<div class="flex justify-center max-md:hidden"><Skeleton class="h-4 w-8" /></div>
		<div class="flex justify-center max-md:hidden"><Skeleton class="h-4 w-8" /></div>
		<div class="flex justify-end"><Skeleton class="h-4 w-10" /></div>
		<div class="flex justify-center max-md:hidden"><Skeleton class="h-4 w-6" /></div>
	</div>
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
			<div class={cn(grid, tableHeadRow, 'h-9')}>
				<div>{t('Pos')}</div>
				<div class="hidden md:block">{t('Change')}</div>
				<div class="hidden text-center md:block">{t('Rank')}</div>
				<div class="hidden text-center md:block">{t('ELO')}</div>
				<div class="hidden text-center md:block">{t('Team')}</div>
				<div>{t('Player')}</div>
				<div class="hidden text-center md:block">{t('Games')}</div>
				<div class="hidden text-center md:block">{t('Wins')}</div>
				<div class="hidden text-center md:block">{t('Losses')}</div>
				<div class="text-right">{t('Win rate')}</div>
				<div class="hidden text-center md:block">{t('Streak')}</div>
			</div>
			<div class="-mb-px">
				{#each players as player (player)}
					{@render playerRow()}
				{/each}
			</div>
		</section>
	{/each}
</div>
