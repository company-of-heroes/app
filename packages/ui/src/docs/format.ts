import type { DocKind, DocModifier, DocRef } from '@company-of-heroes/game-data/types';

const KIND_PATH: Record<DocKind, string> = {
	unit: 'units',
	building: 'buildings',
	commander: 'commanders',
	weapon: 'weapons'
};

/** Docs page path of an item, or null for abilities / upgrades (shown inline, no page). */
export function docsPath(ref: Pick<DocRef, 'kind' | 'slug'>): string | null {
	return ref.kind in KIND_PATH ? `/docs/${KIND_PATH[ref.kind as DocKind]}/${ref.slug}` : null;
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

/** `×0.8` → `−20%`, `+6` additions, enable flags as on/off. */
export function effectValue(effect: DocModifier): { text: string; tone: 'up' | 'down' | 'flag' } {
	const value = effect.value ?? 0;
	if (effect.usage === 'enable') {
		return { text: value > 0 ? 'on' : 'off', tone: 'flag' };
	}

	if (effect.usage === 'multiplication') {
		const percent = Math.round((value - 1) * 1000) / 10;
		return { text: `${percent > 0 ? '+' : ''}${percent}%`, tone: percent >= 0 ? 'up' : 'down' };
	}

	return {
		text: `${value > 0 ? '+' : ''}${formatNumber(value)}`,
		tone: value >= 0 ? 'up' : 'down'
	};
}

/** `tp_armour_axis_panzeriv_skirts` → `Armour axis panzeriv skirts`. */
export function targetTypeLabel(type: string): string {
	const words = type.replace(/^tp_/, '').replace(/_/g, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}
