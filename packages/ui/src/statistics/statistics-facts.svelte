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
	import type { CommunityStatistics } from './types';

	type Props = {
		statistics: CommunityStatistics;
		/** Show at most this many facts. */
		limit?: number;
		class?: string;
	};

	let { statistics, limit, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const facts = $derived.by(() => {
		const { longestMatch, mostActive, busiestHour, topDoctrine, topUnit } = statistics.facts;
		const topMap = statistics.maps[0];
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
		<li class="flex items-center gap-3 px-4 py-2">
			<fact.icon size={18} weight="duotone" class="text-primary shrink-0" />
			<span class="text-secondary-400 shrink-0">{fact.label}</span>
			{#if fact.href}
				<a
					href={fact.href}
					class={cn(interactive, 'ml-auto min-w-0 truncate font-medium text-white hover:underline')}
				>
					{fact.value}
				</a>
			{:else}
				<span class="ml-auto min-w-0 truncate font-medium text-white">{fact.value}</span>
			{/if}
		</li>
	{/each}
</ul>
