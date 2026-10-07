import type { DocKind, DocModifier, DocRef } from '@company-of-heroes/game-data/types';

const KIND_PATH: Record<DocKind, string> = {
	unit: 'units',
	building: 'buildings',
	commander: 'commanders',
	weapon: 'weapons'
};

/**
 * Docs page path of an item. Upgrades that add a weapon go to that weapon's page; other upgrades and
 * abilities have no page (null).
 */
export function docsPath(ref: Pick<DocRef, 'kind' | 'slug' | 'weapon'>): string | null {
	if (ref.kind === 'upgrade' && ref.weapon) {
		return `/wiki/weapons/${ref.weapon}`;
	}

	return ref.kind in KIND_PATH ? `/wiki/${KIND_PATH[ref.kind as DocKind]}/${ref.slug}` : null;
}

/** English labels (i18n keys) for the common modifier types; others are humanized. */
const EFFECT_LABELS: Record<string, string> = {
	received_damage_modifier: 'Received damage',
	received_accuracy_modifier: 'Received accuracy',
	received_suppression_squad_modifier: 'Received suppression',
	received_penetration_modifier: 'Received penetration',
	received_experience_squad_modifier: 'Experience gain',
	accuracy_weapon_modifier: 'Weapon accuracy',
	damage_weapon_modifier: 'Weapon damage',
	cooldown_weapon_modifier: 'Weapon cooldown',
	reload_weapon_modifier: 'Weapon reload time',
	weapon_penetration_modifier: 'Weapon penetration',
	weapon_suppression_modifier: 'Weapon suppression',
	range_weapon_modifier: 'Weapon range',
	burst_weapon_modifier: 'Weapon burst',
	health_maximum_modifier: 'Maximum health',
	health_regeneration_modifier: 'Health regeneration',
	speed_maximum_modifier: 'Top speed',
	posture_speed_modifier: 'Retreat speed',
	sight_radius_modifier: 'Sight radius',
	ability_recharge_time_modifier: 'Ability recharge',
	ability_max_range_modifier: 'Ability range',
	capture_rate_squad_modifier: 'Capture rate',
	production_speed_modifier: 'Production speed',
	income_manpower_player_modifier: 'Manpower income',
	income_fuel_player_modifier: 'Fuel income',
	max_squad_size_modifier: 'Maximum squad size',
	camouflage_enable: 'Camouflage',
	capture_enable_squad_modifier: 'Can capture',
	move_enable_modifier: 'Can move'
};

export function effectLabel(type: string): { key: string; known: boolean } {
	const known = EFFECT_LABELS[type];
	if (known) {
		return { key: known, known: true };
	}

	const words = type
		.replace(/_(squad|player|weapon|entity)?_?modifier$/, '')
		.replace(/_/g, ' ')
		.trim();
	return { key: words.charAt(0).toUpperCase() + words.slice(1), known: false };
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
	if (value === null || value === undefined) {
		return '—';
	}

	return Number(value.toFixed(digits)).toString();
}

/** Modifiers where a lower value helps the unit (less damage taken, shorter cooldowns, ...). */
const LOWER_IS_BETTER = new Set([
	'received_damage_modifier',
	'received_accuracy_modifier',
	'received_suppression_squad_modifier',
	'received_penetration_modifier',
	'cooldown_weapon_modifier',
	'reload_weapon_modifier',
	'ability_recharge_time_modifier',
	'cost_ticks_modifier'
]);

/** `×0.8` → `−20%`, `+6` additions, enable flags as on/off; `tone` says whether it helps the unit. */
export function effectValue(effect: DocModifier): { text: string; tone: 'good' | 'bad' | 'flag' } {
	const value = effect.value ?? 0;
	if (effect.usage === 'enable') {
		return { text: value > 0 ? 'on' : 'off', tone: 'flag' };
	}

	const multiplied = effect.usage === 'multiplication';
	const change = multiplied ? Math.round((value - 1) * 1000) / 10 : value;
	const helps = LOWER_IS_BETTER.has(effect.type) ? change <= 0 : change >= 0;
	const text = multiplied ? `${change}%` : formatNumber(change);
	return { text: `${change > 0 ? '+' : ''}${text}`, tone: helps ? 'good' : 'bad' };
}

/** Several actions can carry the same modifier; each effect once. */
export function uniqueEffects(effects: DocModifier[]): DocModifier[] {
	return effects.filter(
		(effect, index) =>
			effects.findIndex(
				(other) =>
					other.type === effect.type &&
					other.value === effect.value &&
					other.target === effect.target
			) === index
	);
}

/** `tp_armour_axis_panzeriv_skirts` → `Armour axis panzeriv skirts`. */
export function targetTypeLabel(type: string): string {
	const words = type.replace(/^tp_/, '').replace(/_/g, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Cover types in the order players think of them: the three classic covers first (the in-game
 * green / yellow / red shields), then the rest. Labels are i18n keys.
 */
export const COVER_TYPES: {
	key: string;
	label: string;
	tone: 'green' | 'yellow' | 'red' | null;
}[] = [
	{ key: 'tp_heavy', label: 'Heavy cover', tone: 'green' },
	{ key: 'tp_light', label: 'Light cover', tone: 'yellow' },
	{ key: 'tp_negative', label: 'Negative cover', tone: 'red' },
	{ key: 'tp_open', label: 'Open ground', tone: null },
	{ key: 'tp_garrison_cover', label: 'A building (garrisoned)', tone: null },
	{ key: 'tp_garrison_halftrack', label: 'A halftrack (passengers)', tone: null },
	{ key: 'tp_trench', label: 'A trench', tone: null },
	{ key: 'tp_z_bunker', label: 'A bunker', tone: null },
	{ key: 'tp_z_emplacement', label: 'An emplacement', tone: null },
	{ key: 'tp_smoke', label: 'Smoke', tone: null },
	{ key: 'tp_water', label: 'Water', tone: null },
	{ key: 'tp_defcover', label: 'Defensive cover', tone: null },
	{ key: 'tp_defcover_narrow', label: 'Defensive cover (narrow)', tone: null }
];

/** The three classic covers, for compact tables. */
export const CLASSIC_COVER = ['tp_heavy', 'tp_light', 'tp_negative'];

/**
 * Text colour for a weapon multiplier seen from the target's side, as a range matching the in-game
 * cover colours: the lower the multiplier, the better the target is protected (greener); above 1
 * it is exposed, from yellow to red.
 */
export function protectedTone(value: number | undefined): string {
	if (value === undefined || value === 1) {
		return 'text-secondary-500';
	}

	if (value <= 0.25) {
		return 'text-green-400';
	}

	if (value <= 0.6) {
		return 'text-[#94c954]';
	}

	if (value < 1) {
		return 'text-lime-200';
	}

	if (value <= 1.25) {
		return 'text-amber-300';
	}

	return value <= 1.5 ? 'text-orange-400' : 'text-red-400';
}

/**
 * Text colour for how effective a weapon is with a multiplier (against an armour type), as a range:
 * red when it barely works, through orange and yellow, to green when it does more than normal.
 */
export function effectivenessTone(value: number | undefined): string {
	if (value === undefined || value === 1) {
		return 'text-secondary-500';
	}

	if (value < 0.1) {
		return 'text-red-400';
	}

	if (value < 0.4) {
		return 'text-orange-400';
	}

	if (value < 0.8) {
		return 'text-amber-300';
	}

	if (value < 1) {
		return 'text-yellow-200';
	}

	return value <= 1.5 ? 'text-lime-300' : 'text-green-400';
}
