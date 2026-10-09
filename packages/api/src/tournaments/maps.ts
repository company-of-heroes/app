/**
 * Map pool entries are references: a stock or workshop scenario key (the stem of the map images in
 * `app/src/lib/files/maps`, as hosts resolve them with `resolve.mapSrc`) or `custom:<id>`
 * for a staff-made map in `tournament_maps`.
 */
export const BUILT_IN_MAPS = [
	'2p_angoville farms',
	'2p_beach_assault',
	'2p_beaux lowlands',
	'2p_bernieres-sur-mer',
	'2p_best',
	'2p_carpiquet',
	'2p_circle_wall',
	'2p_duclair v1-3',
	'2p_egletons',
	'2p_flooded_plains',
	'2p_industrial riverbed',
	'2p_langres',
	'2p_lyon',
	'2p_ruins_of_rouen',
	'2p_semois',
	'2p_st_mere_dumont',
	'2p_sturzdorf',
	'2p_verrieres_ridge',
	'2p_verrieres_ridge_no_bunkers',
	'2p_wrecked_train',
	'4p_achelous river',
	'4p_alsace moselle',
	'4p_bedum',
	'4p_coastal_harbour',
	'4p_duclair',
	'4p_ecliptic_fields',
	'4p_etavaux',
	'4p_linden',
	'4p_lorraine',
	'4p_lyon',
	'4p_mcgechaens war',
	'4p_point_du_hoc',
	'4p_rails and metal',
	'4p_road_to_montherme',
	'4p_st hilaire',
	'4p_vire river valley',
	'4p_wolfheze',
	'6p_close_river_combat',
	'6p_drekplaats',
	'6p_hedgerow_siege',
	'6p_hill 331',
	'6p_montherme',
	'6p_red_ball_express',
	'6p_refinery',
	'6p_seine_river_docks',
	'6p_villers_bocage',
	'6p_vimoutiers',
	'8p_best',
	'8p_king_of_the_hill',
	'8p_montargis region',
	'8p_route_n13',
	'8p_steel pact'
] as const;

export const CUSTOM_MAP_PREFIX = 'custom:';

export const TOURNAMENT_MAP_ICON_MAX_BYTES = 2 * 1024 * 1024;

const builtIn = new Set<string>(BUILT_IN_MAPS);

export const isBuiltInMap = (ref: string) => builtIn.has(ref);

/** The record id of a `custom:<id>` reference, or null. */
export function customMapId(ref: string): string | null {
	return ref.startsWith(CUSTOM_MAP_PREFIX) ? ref.slice(CUSTOM_MAP_PREFIX.length) || null : null;
}

/**
 * A resolved map pool entry. `stock` and `workshop` maps have no `imageUrl`: hosts resolve their
 * image from `ref` (`resolve.mapSrc`). Workshop maps are `WORKSHOP_MAPS` in
 * `@company-of-heroes/game-data/maps`; `custom` maps are staff-made records.
 */
export type TournamentMap = {
	ref: string;
	name: string;
	imageUrl: string | null;
	source: 'stock' | 'workshop' | 'custom';
};
