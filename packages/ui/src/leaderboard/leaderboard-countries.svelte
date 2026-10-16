<script lang="ts">
	import CountryFlag from '../player/country-flag.svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { countryDisplayName } from '../format/country';
	import { useHost } from '../host/host.context';
	import { useLeaderboard } from './context';
	import { countryCounts } from './highlights';
	import LeaderboardPanel from './leaderboard-panel.svelte';

	const LIMIT = 6;

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	const countries = $derived(countryCounts(leaderboard.stats).slice(0, LIMIT));
	const max = $derived(countries[0]?.count ?? 1);

	function toggle(country: string) {
		leaderboard.filters.country = leaderboard.filters.country === country ? null : country;
	}
</script>

<LeaderboardPanel title={t('Countries')} meta={t('Top 200')}>
	<ul class="pb-3">
		{#each countries as { country, count } (country)}
			{@const name = countryDisplayName(country, host.locale()) ?? country.toUpperCase()}
			{@const active = leaderboard.filters.country === country}
			<li>
				<button
					type="button"
					class={cn(
						interactive,
						'hover:bg-secondary-950/50 flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm transition-colors',
						active && 'text-primary'
					)}
					aria-pressed={active}
					aria-label={t('Only players from {country}', { country: name })}
					onclick={() => toggle(country)}
				>
					<CountryFlag {country} />
					<span class="w-24 shrink-0 truncate">{name}</span>
					<span class="bg-secondary-900 h-1.5 flex-1 overflow-hidden rounded-full">
						<span
							class={cn('block h-full rounded-full', active ? 'bg-primary' : 'bg-secondary-500')}
							style:width="{(count / max) * 100}%"
						></span>
					</span>
					<span class="text-secondary-400 w-7 text-right tabular-nums">{count}</span>
				</button>
			</li>
		{/each}
	</ul>
</LeaderboardPanel>
