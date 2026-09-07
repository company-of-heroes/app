import { localizeHref, DEFAULT_LOCALE, type AppLocale } from '@company-of-heroes/i18n';
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { AuthUser, UserRole } from '@company-of-heroes/api';

export type AuthUserPublic = {
	id: string;
	email: string;
	name?: string;
	avatarUrl?: string;
	steamIds?: string[];
	role?: UserRole;
	verified: boolean;
};

export function serializeAuthUser(pb: PocketBase, record: RecordModel | null): AuthUserPublic | null {
	if (!record) {
		return null;
	}

	const user = record as AuthUser;
	let avatarUrl: string | undefined;
	if (user.avatar) {
		avatarUrl = pb.files.getURL(user, user.avatar);
	}

	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl,
		steamIds: user.steamIds,
		role: user.role,
		verified: Boolean(user.verified)
	};
}

export function authDisplayName(user: AuthUserPublic): string {
	if (user.name?.trim()) {
		return user.name.trim();
	}

	return user.email;
}

/** Steam IDs linked to the signed-in account — used to highlight "me" in match/lobby lists. */
export function meSteamIds(user: AuthUserPublic | null | undefined): string[] {
	return user?.steamIds?.filter((id): id is string => Boolean(id)) ?? [];
}

export function isStaffUser(user: AuthUserPublic | null | undefined): boolean {
	return user?.role === 'admin' || user?.role === 'moderator';
}

export function loginRedirectHref(next: string, locale: AppLocale = DEFAULT_LOCALE) {
	const path =
		typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
	return localizeHref(`/login?redirect=${encodeURIComponent(path)}`, locale);
}
