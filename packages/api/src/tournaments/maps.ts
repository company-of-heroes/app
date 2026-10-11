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

/** Wiki page slug (`/wiki/maps/<slug>`) of each built-in map, from `game-data/data/stock-maps.json`. */
const WIKI_SLUGS: Record<(typeof BUILT_IN_MAPS)[number], string> = {
	'2p_angoville farms': 'angoville-2p',
	'2p_beach_assault': 'beach-assault-2p',
	'2p_beaux lowlands': 'beaux-lowlands-2p',
	'2p_bernieres-sur-mer': 'bernieres-sur-mer-2p',
	'2p_best': 'best-2p',
	'2p_carpiquet': 'carpiquet-2p',
	'2p_circle_wall': 'hinderdam-2p',
	'2p_duclair v1-3': 'duclair-2p',
	'2p_egletons': 'egletons-2p',
	'2p_flooded_plains': 'flooded-plains-2p',
	'2p_industrial riverbed': 'industrial-riverbed-2p',
	'2p_langres': 'langres-2p',
	'2p_lyon': 'lyon-2p',
	'2p_ruins_of_rouen': 'ruins-of-rouen-2p',
	'2p_semois': 'semois-2p',
	'2p_st_mere_dumont': 'st-mere-dumont-2p',
	'2p_sturzdorf': 'sturzdorf-2p',
	'2p_verrieres_ridge': 'verrieres-ridge-2p',
	'2p_verrieres_ridge_no_bunkers': 'verrieres-ridge-no-bunkers-2p',
	'2p_wrecked_train': 'wrecked-train-2p',
	'4p_achelous river': 'achelous-river-4p',
	'4p_alsace moselle': 'alsace-moselle-4p',
	'4p_bedum': 'bedum-4p',
	'4p_coastal_harbour': 'gilroys-harbor-4p',
	'4p_duclair': 'duclair-4p',
	'4p_ecliptic_fields': 'ecliptic-fields-4p',
	'4p_etavaux': 'etavaux-4p',
	'4p_linden': 'linden-4p',
	'4p_lorraine': 'lorraine-4p',
	'4p_lyon': 'lyon-4p',
	'4p_mcgechaens war': 'mcgechaens-war-4p',
	'4p_point_du_hoc': 'pointe-du-hoc-4p',
	'4p_rails and metal': 'rails-and-metal-4p',
	'4p_road_to_montherme': 'road-to-montherme-4p',
	'4p_st hilaire': 'st-hilaire-4p',
	'4p_vire river valley': 'vire-river-valley-4p',
	'4p_wolfheze': 'wolfheze-4p',
	'6p_close_river_combat': 'the-scheldt-6p',
	'6p_drekplaats': 'drekplaats-6p',
	'6p_hedgerow_siege': 'hedgerow-siege-6p',
	'6p_hill 331': 'hill-331-6p',
	'6p_montherme': 'montherme-6p',
	'6p_red_ball_express': 'red-ball-express-6p',
	'6p_refinery': 'refinery-6p',
	'6p_seine_river_docks': 'seine-river-docks-6p',
	'6p_villers_bocage': 'villers-bocage-6p',
	'6p_vimoutiers': 'vimoutiers-6p',
	'8p_best': 'the-hochwald-gap-8p',
	'8p_king_of_the_hill': 'king-of-the-hill-8p',
	'8p_montargis region': 'montargis-region-8p',
	'8p_route_n13': 'route-n13-8p',
	'8p_steel pact': 'steel-pact-8p'
};

/** Wiki page slug of a built-in map; workshop and custom maps have no wiki page. */
export const wikiMapSlug = (ref: string): string | null =>
	isBuiltInMap(ref) ? WIKI_SLUGS[ref as (typeof BUILT_IN_MAPS)[number]] : null;

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
