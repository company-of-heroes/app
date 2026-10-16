import { api, unwrapApi } from '$core/api';
import {
	DEFAULT_LABEL_HEX,
	labelColorSwatches,
	labelHex,
	sortUserLabels as sortUserLabelsApi,
	labelsBySteamId as labelsBySteamIdApi,
	type UserLabel as ApiUserLabel,
	type UserLabelInput,
	type PlayerLabelAssignment as ApiPlayerLabelAssignment
} from '@company-of-heroes/api';
import type { PlayerLabelAssignmentsResponse, UserLabelsResponse } from './types';

export type UserLabel = UserLabelsResponse;
export type PlayerLabelAssignment = PlayerLabelAssignmentsResponse<{ label?: UserLabelsResponse }>;

export { DEFAULT_LABEL_HEX, labelColorSwatches, labelHex };

export function sortUserLabels(labels: UserLabelsResponse[]): UserLabelsResponse[] {
	return sortUserLabelsApi(labels as ApiUserLabel[]) as UserLabelsResponse[];
}

export function labelsBySteamId(
	assignments: PlayerLabelAssignment[]
): Record<string, UserLabelsResponse[]> {
	return labelsBySteamIdApi(assignments as ApiPlayerLabelAssignment[]) as Record<
		string,
		UserLabelsResponse[]
	>;
}

export async function listUserLabels(): Promise<UserLabelsResponse[]> {
	return (await unwrapApi(api.labels.listUserLabels())) as UserLabelsResponse[];
}

export async function listAssignmentsForSteamIds(
	steamIds: string[]
): Promise<PlayerLabelAssignment[]> {
	return (await unwrapApi(
		api.labels.listAssignmentsForSteamIds(steamIds)
	)) as PlayerLabelAssignment[];
}

export async function loadLabelsBySteamId(
	steamIds: string[]
): Promise<Record<string, UserLabelsResponse[]>> {
	return (await unwrapApi(api.labels.loadLabelsBySteamId(steamIds))) as Record<
		string,
		UserLabelsResponse[]
	>;
}

export async function assignPlayerLabel(data: {
	steamId: string;
	profileId: number;
	alias?: string;
	labelId: string;
}): Promise<PlayerLabelAssignment> {
	return (await unwrapApi(api.labels.assign(data))) as PlayerLabelAssignment;
}

export async function unassignPlayerLabel(assignmentId: string): Promise<void> {
	await unwrapApi(api.labels.unassign(assignmentId));
}

export async function createUserLabel(data: UserLabelInput): Promise<void> {
	await unwrapApi(api.labels.createUserLabel(data));
}

export async function updateUserLabel(id: string, data: UserLabelInput): Promise<void> {
	await unwrapApi(api.labels.updateUserLabel(id, data));
}

export async function deleteUserLabel(id: string): Promise<void> {
	await unwrapApi(api.labels.deleteUserLabel(id));
}
