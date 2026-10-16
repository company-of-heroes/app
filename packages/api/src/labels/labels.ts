import { ClientResponseError, type RecordModel } from 'pocketbase';
import type { RewardCondition } from '@company-of-heroes/ui/reward/metrics';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { mapLimit } from '../concurrency';
import type { ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { PlayersApi } from '../players/players';
import { escapePocketBaseString, fromPbPromise, pbOptions, recordId } from '../pb';

export type UserLabel = RecordModel & {
	name: string;
	color: string;
	sort?: number;
	tooltip?: string;
	/** Stable identifier of a system label, e.g. `supporter`. */
	key?: string;
	/** Managed by the product: cannot be deleted or assigned by hand. */
	system?: boolean;
	/** Granted automatically for rank 20 on two 1v1/2v2 ladders. */
	autoRank20?: boolean;
	/** Reward conditions: granted to every linked Steam ID that meets all of them. */
	conditions?: RewardCondition[] | null;
};

export type PlayerLabelAssignment = RecordModel & {
	steamId: string;
	profileId: number;
	alias?: string;
	label: string;
	expand?: { label?: UserLabel };
};

/** The editable fields of a label; `system`, `key` and (on system labels) `conditions` are not. */
export type UserLabelInput = {
	name?: string;
	color?: string;
	tooltip?: string;
	sort?: number;
	autoRank20?: boolean;
	conditions?: RewardCondition[] | null;
};

const SYSTEM_LABEL_MESSAGE = 'This label is managed by the product.';

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

/** PocketBase answers 404 for a collection that does not exist yet. */
function isMissingCollection(error: unknown): boolean {
	return error instanceof ClientResponseError && error.status === 404;
}

/** A create rejected by a unique index. */
function isUniqueCollision(error: unknown): boolean {
	if (!(error instanceof ClientResponseError) || error.status !== 400) {
		return false;
	}

	const data = (error.response?.data ?? {}) as Record<string, { code?: string } | undefined>;
	return Object.values(data).some((field) => field?.code === 'validation_not_unique');
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

	/** `system` and `key` are never taken from the caller. */
	createUserLabel(data: UserLabelInput): ResultAsync<UserLabel, ApiError> {
		const { name, color, tooltip, sort, autoRank20, conditions } = data;
		return fromPbPromise(
			this.deps.pocketbase
				.collection('user_labels')
				.create<UserLabel>(
					{ name, color, tooltip, sort, autoRank20, conditions },
					pbOptions(this.deps)
				),
			'Failed to create label.'
		);
	}

	/** On a system label only name, colour, tooltip and sort change; the rest is dropped. */
	updateUserLabel(id: string, data: UserLabelInput): ResultAsync<UserLabel, ApiError> {
		return this.getUserLabel(id, 'Failed to update label.').andThen((label) => {
			const { name, color, tooltip, sort, autoRank20, conditions } = data;
			const patch = label.system
				? { name, color, tooltip, sort }
				: { name, color, tooltip, sort, autoRank20, conditions };
			return fromPbPromise(
				this.deps.pocketbase
					.collection('user_labels')
					.update<UserLabel>(id, patch, pbOptions(this.deps)),
				'Failed to update label.'
			);
		});
	}

	/** A system label cannot be deleted. */
	deleteUserLabel(id: string): ResultAsync<void, ApiError> {
		return this.getUserLabel(id, 'Failed to delete label.')
			.andThen((label) =>
				label.system
					? errAsync(apiError(403, SYSTEM_LABEL_MESSAGE))
					: fromPbPromise(
							this.deps.pocketbase.collection('user_labels').delete(id, pbOptions(this.deps)),
							'Failed to delete label.'
						)
			)
			.map(() => undefined);
	}

	private getUserLabel(id: string, message: string): ResultAsync<UserLabel, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('user_labels')
				.getOne<UserLabel>(id, pbOptions(this.deps, { fields: 'id,system' })),
			message
		);
	}

	/** A system label cannot be assigned by hand. */
	assign(data: {
		steamId: string;
		profileId: number;
		alias?: string;
		labelId: string;
	}): ResultAsync<PlayerLabelAssignment, ApiError> {
		return this.getUserLabel(data.labelId, 'Failed to assign label.').andThen((label) =>
			label.system ? errAsync(apiError(403, SYSTEM_LABEL_MESSAGE)) : this.createAssignment(data)
		);
	}

	private createAssignment(data: {
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
		)
			.andThen((assignment) =>
				this.clearRevocation(data.steamId, data.labelId).map(() => assignment)
			)
			.map((assignment) => {
				new PlayersApi(this.deps).invalidate(data.steamId);
				return assignment;
			});
	}

	/**
	 * Removes an assignment and records the removal, so the auto-label and reward jobs do not
	 * hand the label back. Assigning it again clears the record.
	 */
	unassign(assignmentId: string): ResultAsync<void, ApiError> {
		const assignments = this.deps.pocketbase.collection('player_label_assignments');
		return fromPbPromise(
			assignments.getOne<PlayerLabelAssignment>(
				assignmentId,
				pbOptions(this.deps, { fields: 'id,steamId,label' })
			),
			'Failed to unassign label.'
		)
			.andThen((assignment) => this.revoke(assignment.steamId, recordId(assignment.label)))
			.andThen(() =>
				fromPbPromise(
					assignments.delete(assignmentId, pbOptions(this.deps)),
					'Failed to unassign label.'
				)
			)
			.map(() => {
				new PlayersApi(this.deps).invalidate();
			});
	}

	/**
	 * A revocation for the pair, written before the assignment is deleted so a failure
	 * leaves the label in place. One that already exists counts as done; without the
	 * collection (PocketBase not migrated yet) it is skipped.
	 */
	private revoke(steamId: string, labelId: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('player_label_revocations')
				.create({ steamId, label: labelId }, pbOptions(this.deps))
				.then(() => undefined)
				.catch((error) => {
					if (isMissingCollection(error) || isUniqueCollision(error)) {
						return undefined;
					}

					throw error;
				}),
			'Failed to unassign label.'
		);
	}

	/**
	 * Deletes a staff revocation of the pair, so the jobs may grant the label again. The
	 * label is already assigned, so a failure is only logged.
	 */
	private clearRevocation(steamId: string, labelId: string): ResultAsync<void, ApiError> {
		const revocations = this.deps.pocketbase.collection('player_label_revocations');
		return fromPbPromise(
			revocations
				.getFullList<RecordModel>(
					pbOptions(this.deps, {
						filter: `steamId = "${escapePocketBaseString(steamId)}" && label = "${escapePocketBaseString(labelId)}"`,
						fields: 'id'
					})
				)
				.catch((error) => {
					if (isMissingCollection(error)) {
						return [];
					}

					throw error;
				}),
			'Failed to assign label.'
		)
			.andThen((rows) =>
				ResultAsync.combine(
					rows.map((row) =>
						fromPbPromise(
							revocations.delete(row.id, pbOptions(this.deps)),
							'Failed to assign label.'
						)
					)
				).map(() => undefined)
			)
			.orElse((error) => {
				console.warn('[labels] could not clear revocation', steamId, labelId, error.message);
				return okAsync(undefined);
			});
	}

	private async loadAssignments(ids: string[]): Promise<PlayerLabelAssignment[]> {
		const size = 40;
		const chunks: string[][] = [];
		for (let i = 0; i < ids.length; i += size) {
			chunks.push(ids.slice(i, i + size));
		}

		const rows = await mapLimit(chunks, 4, (chunk) =>
			this.deps.pocketbase
				.collection('player_label_assignments')
				.getFullList<PlayerLabelAssignment>(
					pbOptions(this.deps, {
						filter: chunk.map((id) => `steamId = "${escapePocketBaseString(id)}"`).join(' || '),
						fields: 'id,steamId,profileId,alias,label,expand',
						expand: 'label'
					})
				)
		);

		return rows.flat();
	}
}
