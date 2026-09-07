import type { ReplayPlayer } from '@company-of-heroes/ui/replay';
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

type ReplayPlayerWithDoctrine = ReplayPlayer & { doctrine?: number };

export function doctrineBannerUrl(player: ReplayPlayerWithDoctrine): string | null {
	const doctrine = player.doctrine;
	if (doctrine == null) {
		return null;
	}

	if (player.faction.startsWith('allies')) {
		switch (doctrine) {
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
				return null;
		}
	}

	switch (doctrine) {
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
			return null;
	}
}

export function raceFromReplayFaction(faction: string): number {
	const value = faction.toLowerCase();
	if (value.includes('commonwealth')) {
		return 2;
	}

	if (value.includes('panzer')) {
		return 3;
	}

	if (value.startsWith('axis')) {
		return 1;
	}

	return 0;
}
