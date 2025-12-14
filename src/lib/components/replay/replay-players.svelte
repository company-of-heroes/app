<script lang="ts">
	import type { Player } from '@fknoobs/replay-parser';
	import { useReplay } from '.';
	import DoctrineAir from '$lib/files/ct_branchbanner_top_allied_airborne.png?url';
	import DoctrineArmored from '$lib/files/ct_branchbanner_top_allied_armor.png?url';
	import DoctrineInfantry from '$lib/files/ct_branchbanner_top_allied_infantry.png?url';
	import DoctrineBlitz from '$lib/files/ct_branchbanner_top_axis_blitz.png?url';
	import DoctrineTerror from '$lib/files/ct_branchbanner_top_axis_terror.png?url';
	import DoctrineDefense from '$lib/files/ct_branchbanner_top_axis_defense.png?url';
	import DoctrineCwAir from '$lib/files/ct_branchbanner_top_cmnw_airborne.png?url';
	import DoctrineCwArmor from '$lib/files/ct_branchbanner_top_cmnw_armor.png?url';
	import DoctrineCwInfantry from '$lib/files/ct_branchbanner_top_cmnw_infantry.png?url';
	import DoctrineLuft from '$lib/files/ct_branchbanner_top_pnze_00.png?url';
	import DoctrineSector from '$lib/files/ct_branchbanner_top_pnze_01.png?url';
	import DoctrineTank from '$lib/files/ct_branchbanner_top_pnze_02.png?url';
	import { AspectRatio } from 'bits-ui';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
	let replay = useReplay();

	const teams = $derived.by(() => {
		const axis = replay.players.filter((p) => p.faction.startsWith('axis'));
		const allies = replay.players.filter((p) => p.faction.startsWith('allies'));

		return { axis, allies };
	});
	// 2: "Airborne",
	// 9: "Armor",
	// 17: "Infantry",
	// 186: "Blitzkrieg",
	// 194: "Defensive",
	// 265: "Terror",
	// 295: "Luftwaffe",
	// 302: "Scorched Earth",
	// 309: "Tank Destroyer",
	// 316: "Royal Artillery",
	// 323: "Royal Commandos",
	// 330: "Royal Engineers",
	const getDoctrineImage = (player: Player) => {
		if (player.faction.startsWith('allies')) {
			switch (player.doctrine) {
				case 2:
					return DoctrineAir;
				case 9:
					return DoctrineArmored;
				case 17:
					return DoctrineInfantry;
				case 316:
					return DoctrineCwInfantry;
				case 323:
					return DoctrineCwAir;
				case 330:
					return DoctrineCwArmor;
				default:
					return '';
			}
		} else {
			switch (player.doctrine) {
				case 186:
					return DoctrineBlitz;
				case 194:
					return DoctrineDefense;
				case 265:
					return DoctrineTerror;
				case 295:
					return DoctrineLuft;
				case 302:
					return DoctrineSector;
				case 309:
					return DoctrineTank;
				default:
					return '';
			}
		}
	};
</script>

{#snippet player(player: Player)}
	{@const actions = replay.actions.filter((a) => a.playerID === player.id)}
	{@const durationMinutes = replay.duration / 60}
	{@const CPM = durationMinutes > 0 ? (actions.length / durationMinutes).toFixed(0) : '0'}
	<div
		class={cn(
			'grid grid-cols-[130px_auto] overflow-clip rounded-lg',
			'bg-gray-950/40 bg-cover bg-center bg-no-repeat bg-blend-multiply'
		)}
	>
		<div>
			<AspectRatio.Root ratio={1 / 1} class="bg-gray-950/80">
				{#if player.doctrineName}
					<img
						src={getDoctrineImage(player)}
						alt={player.doctrineName}
						class="h-full w-full object-cover opacity-65"
					/>
				{/if}
			</AspectRatio.Root>
		</div>
		<div class="flex flex-col px-6 py-4">
			<span class="text-primary-50 flex items-center gap-2 truncate text-lg font-bold">
				<img
					src={getFactionFlagFromRace(
						player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
					)}
					alt={player.faction}
					class="h-4"
				/>
				<span>{player.name}</span>
			</span>
			<span>Doctrine: {player.doctrineName || '-'}</span>
			<span>CPM: {CPM}</span>
		</div>
	</div>
{/snippet}

<div {...restProps} class={cn('grid grid-cols-2 gap-4', restProps.class)}>
	<div class={cn('grid grid-cols-1 gap-2', teams.allies.length === 1 && ' grid-cols-1')}>
		{#each teams.allies as p (p.id)}
			{@render player(p)}
		{/each}
	</div>
	<div class={cn('grid grid-cols-1 gap-2', teams.allies.length === 1 && ' grid-cols-1')}>
		{#each teams.axis as p (p.id)}
			{@render player(p)}
		{/each}
	</div>
</div>
