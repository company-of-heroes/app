import type { RecordModel } from 'pocketbase';
import { okAsync, ResultAsync } from 'neverthrow';
import type { ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import { escapePocketBaseString, fromPbPromise, pbOptions } from '../pb';

export type UserLabel = RecordModel & {
	name: string;
	color: string;
	sort?: number;
};

export type PlayerLabelAssignment = RecordModel & {
	steamId: string;
	profileId: number;
	alias?: string;
	label: string;
	expand?: { label?: UserLabel };
};

export const DEFAULT_LABEL_HEX = '#FEC766';

const TOKEN_HEX: Record<string, string> = {
	primary: '#FEC766',
	default: '#A3A3A8',
	warning: '#E5B84C',
	success: '#3DBA63',
	info: '#3B8FD9',
	destructive: '#E5484D'
};

export const labelColorSwatches = [
	TOKEN_HEX.primary,
	TOKEN_HEX.default,
	TOKEN_HEX.warning,
	TOKEN_HEX.success,
	TOKEN_HEX.info,
	TOKEN_HEX.destructive
];

export function labelHex(color?: string | null): string {
	if (!color) {
		return DEFAULT_LABEL_HEX;
	}

	if (TOKEN_HEX[color]) {
		return TOKEN_HEX[color];
	}

	if (/^#[0-9A-Fa-f]{8}$/.test(color)) {
		return color.slice(0, 7);
	}

	if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
		return color;
	}

	if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
		return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
	}

	return DEFAULT_LABEL_HEX;
}

export function sortUserLabels(labels: UserLabel[]): UserLabel[] {
	return [...labels].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
}

export function labelsBySteamId(assignments: PlayerLabelAssignment[]): Record<string, UserLabel[]> {
	const bySteam: Record<string, UserLabel[]> = {};
	for (const assignment of assignments) {
		const steamId = assignment.steamId;
		const label = assignment.expand?.label;
		if (!steamId || !label) {
			continue;
		}

		const current = bySteam[steamId] ?? [];
		current.push(label);
		bySteam[steamId] = current;
	}

	for (const steamId of Object.keys(bySteam)) {
		bySteam[steamId] = sortUserLabels(bySteam[steamId]);
	}

	return bySteam;
}

export class LabelsApi {
	constructor(private deps: ApiDeps) {}

	listUserLabels(): ResultAsync<UserLabel[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('user_labels')
				.getFullList<UserLabel>(pbOptions(this.deps, { sort: 'sort,name' })),
			'Failed to load labels.'
		);
	}

	listAssignmentsForSteamIds(steamIds: string[]): ResultAsync<PlayerLabelAssignment[], ApiError> {
		const ids = [...new Set(steamIds.filter(Boolean))];
		if (ids.length === 0) {
			return okAsync([]);
		}

		return ResultAsync.fromSafePromise(this.loadAssignments(ids));
	}

	loadLabelsBySteamId(steamIds: string[]): ResultAsync<Record<string, UserLabel[]>, ApiError> {
		return this.listAssignmentsForSteamIds(steamIds).map(labelsBySteamId);
	}

	assign(data: {
		steamId: string;
		profileId: number;
		alias?: string;
		labelId: string;
	}): ResultAsync<PlayerLabelAssignment, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('player_label_assignments').create<PlayerLabelAssignment>(
				{
					steamId: data.steamId,
					profileId: data.profileId,
					alias: data.alias,
					label: data.labelId
				},
				pbOptions(this.deps, { expand: 'label' })
			),
			'Failed to assign label.'
		);
	}

	unassign(assignmentId: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('player_label_assignments')
				.delete(assignmentId, pbOptions(this.deps)),
			'Failed to unassign label.'
		).map(() => undefined);
	}

	private async loadAssignments(ids: string[]): Promise<PlayerLabelAssignment[]> {
		const assignments: PlayerLabelAssignment[] = [];
		const size = 40;
		for (let i = 0; i < ids.length; i += size) {
			const chunk = ids.slice(i, i + size);
			const rows = await this.deps.pocketbase
				.collection('player_label_assignments')
				.getFullList<PlayerLabelAssignment>(
					pbOptions(this.deps, {
						filter: chunk.map((id) => `steamId = "${escapePocketBaseString(id)}"`).join(' || '),
						expand: 'label'
					})
				);
			assignments.push(...rows);
		}

		return assignments;
	}
}
