<script lang="ts">
	import type { TransformedMatch } from '@fknoobs/app';
	import dayjs from '$lib/dayjs';
	import {
		cn,
		getFactionFlagFromRace,
		getRacePrefix,
		getRankImage,
		normalizeMapName
	} from '$lib/utils';
	import { getMapImageFromName } from '$lib/utils/game';
	import { H } from '../ui/h';
	import { orderBy, sortBy, upperCase } from 'lodash-es';
	import ClockIcon from 'phosphor-svelte/lib/Clock';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import { page } from '$app/state';

	type Props = {
		matches: TransformedMatch[];
	};

	let { matches }: Props = $props();
	let orderedMatches = $derived(orderBy(matches, ['completiontime'], ['desc']));
	console.log(orderedMatches);
</script>

<div class="grid gap-2">
	{#each orderedMatches as match}
		<div>
			<div
				class="text-primary-100 flex items-center justify-between rounded-t-md bg-gray-700 px-4 py-2 font-semibold"
			>
				<span class="flex items-center gap-2">
					<ClockIcon />
					{Math.floor(
						dayjs.unix(match.completiontime).diff(dayjs.unix(match.startgametime), 'seconds') / 60
					)}:{String(
						dayjs.unix(match.completiontime).diff(dayjs.unix(match.startgametime), 'seconds') % 60
					).padStart(2, '0')}
				</span>
				<span>{normalizeMapName(match.mapname)}</span>
				<span>{dayjs.unix(match.startgametime).format('YYYY-MM-DD HH:mm')}</span>
			</div>
			<div>
				<div>
					{#each sortBy(match.players, ['teamid']) as player}
						<div
							class={cn(
								'grid w-full grid-cols-[2rem_2rem_6rem_auto_4rem_4rem_4rem] items-center gap-6 px-4 py-2',
								'border-gray-700 not-last:border-b-2',
								player.outcome === 1 ? 'bg-green-900/5' : 'bg-red-900/5',
								player.profile_id === parseInt(page.params.profileId!) &&
									'ring-primary-200/50 text-primary ring'
							)}
						>
							{#await getFactionFlagFromRace(player.race_id) then flagImg}
								<img
									src={flagImg}
									alt={getRacePrefix(player.race_id)}
									class="w-6 ring-2 ring-black"
								/>
							{/await}
							<span class="text-center">{player.newrating}</span>
							<span class="flex items-center justify-between gap-4">
								{#if player.newrating < player.oldrating}
									<span class="flex items-center gap-2">
										<CaretDown class="text-red-500" weight="duotone" />
										<span class="text-sm text-red-100">
											{player.oldrating - player.newrating}
										</span>
									</span>
								{:else if player.newrating > player.oldrating}
									<span class="flex items-center gap-2">
										<CaretUp class="text-green-500" weight="duotone" />
										<span class="text-sm text-green-100">
											{player.newrating - player.oldrating}
										</span>
									</span>
								{/if}
							</span>
							<a
								class={cn('flex items-center gap-2')}
								href={`/leaderboards/profile/${player.profile_id}`}
							>
								<img
									class="w-6"
									src="https://flagsapi.com/{upperCase(player.country)}/shiny/64.png"
									alt={player.country}
								/>
								{player.alias}
							</a>
							<span class="text-center text-green-200">
								{player.wins}
							</span>
							<span class="text-center text-red-200">
								{player.losses}
							</span>
							<span
								class={cn('text-center', player.streak > 0 ? 'text-green-500' : 'text-red-500')}
							>
								{player.streak > 0 ? `+${player.streak}` : player.streak}
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/each}
</div>
