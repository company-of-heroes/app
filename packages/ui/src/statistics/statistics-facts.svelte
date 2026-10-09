<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import FactoryIcon from 'phosphor-svelte/lib/FactoryIcon';
	import FlagBannerIcon from 'phosphor-svelte/lib/FlagBannerIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import MapPinIcon from 'phosphor-svelte/lib/MapPinIcon';
	import { useHost } from '../host/host.context';
	import { getRaceLabel, normalizeMapName } from '../format/player-format';
	import { formatCount, minutes } from './format';
	import { useStatistics } from './context';

	type Props = {
		/** Show at most this many facts. */
		limit?: number;
		class?: string;
	};

	let { limit, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const context = useStatistics();

	const facts = $derived.by(() => {
		const { statistics, selected } = context;
		const { longestMatch, mostActive, busiestHour, topDoctrine, topUnit } = statistics.facts;
		// Filtered on one map: "most played map" would just name it, so it is left out.
		const topMap = selected ? undefined : statistics.maps[0];
		const list: {
			key: string;
			icon: typeof ClockIcon;
			label: string;
			value: string;
			href?: string;
		}[] = [];
		if (mostActive) {
			list.push({
				key: 'active',
				icon: CrownIcon,
				label: t('Most active player'),
				value: t('{name} · {games} games', {
					name: mostActive.alias || String(mostActive.profileId),
					games: formatCount(mostActive.games, host.locale())
				}),
				href: host.routes.player(mostActive.profileId)
			});
		}

		if (topDoctrine) {
			list.push({
				key: 'doctrine',
				icon: FlagBannerIcon,
				label: t('Most picked doctrine'),
				value: `${topDoctrine.name} (${t(getRaceLabel(topDoctrine.raceId))})`
			});
		}

		if (topUnit) {
			list.push({
				key: 'unit',
				icon: FactoryIcon,
				label: t('Most built unit'),
				value: `${topUnit.name} (${t(getRaceLabel(topUnit.raceId))})`
			});
		}

		if (longestMatch) {
			list.push({
				key: 'longest',
				icon: HourglassIcon,
				label: t('Longest match'),
				value: t('{minutes} min on {map}', {
					minutes: minutes(longestMatch.durationSeconds) ?? 0,
					map: normalizeMapName(longestMatch.map)
				}),
				href: host.routes.match(longestMatch.lobbyId)
			});
		}

		if (topMap) {
			list.push({
				key: 'map',
				icon: MapPinIcon,
				label: t('Most played map'),
				value: normalizeMapName(topMap.map)
			});
		}

		if (busiestHour !== null) {
			const hour = String(busiestHour).padStart(2, '0');
			list.push({
				key: 'hour',
				icon: ClockIcon,
				label: t('Busiest hour'),
				value: `${hour}:00 – ${hour}:59 UTC`
			});
		}

		return limit === undefined ? list : list.slice(0, limit);
	});
</script>

<ul class={cn('divide-secondary-800 divide-y text-sm', className)}>
	{#each facts as fact (fact.key)}
		<li class="flex items-start gap-3 px-4 py-2 sm:items-center">
			<fact.icon size={18} weight="duotone" class="text-primary mt-px shrink-0 sm:mt-0" />
			<!-- Stacks label over value on narrow screens so long values are not cut off. -->
			<div class="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
				<span class="text-secondary-400 sm:shrink-0">{fact.label}</span>
				{#if fact.href}
					<a
						href={fact.href}
						class={cn(
							interactive,
							'min-w-0 font-medium break-words text-white hover:underline sm:ml-auto sm:truncate'
						)}
					>
						{fact.value}
					</a>
				{:else}
					<span class="min-w-0 font-medium break-words text-white sm:ml-auto sm:truncate"
						>{fact.value}</span
					>
				{/if}
			</div>
		</li>
	{/each}
</ul>
