import { ClientResponseError } from 'pocketbase';
import { fetch } from '$core/http/fetch';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { isEmpty, uniq } from 'lodash-es';
import { pocketbase } from '$core/pocketbase';
import { UsersRoleOptions, type UsersResponse } from '$core/pocketbase/types';
import { settings } from '$core/config/settings.svelte';
import type { AccountSettings } from '$core/config/schema';
import { generatePassword, generateUniqueId } from '$lib/utils/password';
import { steam } from '$core/steam';
import { ensureAccountFlow, type AuthResult, type RecoveryOutcome } from './recovery';
import { t } from '$lib/i18n';
import { api } from '$core/api';
import { canRequestEmailChange, isPlaceholderEmail } from '@company-of-heroes/api';

export type User = UsersResponse<Record<string, any>, string[], Record<string, any>>;

export type AccountStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

function metaWithVersion(meta: Record<string, any> | null | undefined, version: string) {
	return { ...(meta && typeof meta === 'object' ? meta : {}), version };
}

function fieldErrorMessage(error: ClientResponseError): string {
	const data = error.data as
		| { message?: string; data?: Record<string, { message?: string }> }
		| undefined;
	const fieldMessage = data?.data
		? Object.values(data.data)
				.map((field) => field?.message)
				.filter(Boolean)
				.join(' ')
		: '';

	return fieldMessage || data?.message || error.message;
}

/**
 * Manages the app's PocketBase account (replaces the old `auth` feature).
 *
 * The full flow lives in `recovery.ts`; this service wires PocketBase, the
 * settings tree and the backup service into it and owns the reactive state.
 */
export class AccountService {
	#user = $state<User | null>(null);

	status = $state<AccountStatus>('idle');
	lastError = $state<string | null>(null);

	/**
	 * Authenticates the account, recovering or creating it when necessary.
	 * Returns the outcome; on success the credentials are persisted and
	 * backed up externally.
	 */
	async ensureAccount(): Promise<RecoveryOutcome> {
		this.status = 'authenticating';
		this.lastError = null;

		const outcome = await ensureAccountFlow($state.snapshot(settings.tree.account), {
			authenticate: (credentials) => this.#authenticate(credentials),
			createAccount: (credentials) => this.#createAccount(credentials),
			findBackupAccount: () => this.#findBackupAccount(),
			confirmCreateNew: () =>
				confirm(
					t(
						'Your account could not be found and no working backup was detected.\n\nDo you want to create a new account? Your previous match history will no longer be linked.'
					),
					{ okLabel: t('Create new account'), cancelLabel: t('Cancel'), kind: 'warning' }
				),
			generateCredentials: () => ({
				userId: generateUniqueId(),
				email: crypto.randomUUID() + '@fknoobs.com',
				password: generatePassword(),
				pendingEmail: ''
			})
		});

		if (outcome.action === 'failed') {
			this.status = 'error';
			this.lastError =
				outcome.reason === 'declined'
					? t('Account setup cancelled')
					: (outcome.error ?? t('Unknown account error'));
			console.error('[ACCOUNT]: ensureAccount failed:', outcome);
			return outcome;
		}

		// Persist (possibly restored/new) credentials.
		const changed =
			settings.tree.account.userId !== outcome.credentials.userId ||
			settings.tree.account.email !== outcome.credentials.email ||
			settings.tree.account.password !== outcome.credentials.password;

		if (changed) {
			settings.tree.account = {
				...outcome.credentials,
				pendingEmail: settings.tree.account.pendingEmail ?? ''
			};
			await settings.persistNow();
		}

		// Credentials must never exist only inside the app data directory.
		if (outcome.created || changed) {
			await settings.backup.backupNow('account-created');
		}

		this.status = 'authenticated';
		void this.#postLogin();

		return outcome;
	}

	async #authenticate(credentials: AccountSettings): Promise<AuthResult> {
		const tryAuth = async (email: string) => {
			const auth = await pocketbase
				.collection('users')
				.authWithPassword<User>(email, credentials.password, { fetch });
			this.#user = auth.record;
			return auth;
		};

		try {
			await tryAuth(credentials.email);
			await this.#syncLocalEmailFromUser();
			return 'ok';
		} catch (error) {
			const pending = credentials.pendingEmail?.trim();
			if (
				pending &&
				pending !== credentials.email &&
				error instanceof ClientResponseError &&
				(error.status === 400 || error.status === 404)
			) {
				try {
					await tryAuth(pending);
					settings.tree.account = {
						...settings.tree.account,
						email: pending,
						pendingEmail: ''
					};
					await settings.persistNow();
					await settings.backup.backupNow('email-sync');
					return 'ok';
				} catch (pendingError) {
					if (
						pendingError instanceof ClientResponseError &&
						(pendingError.status === 400 || pendingError.status === 404)
					) {
						return 'invalid';
					}

					throw pendingError;
				}
			}

			if (error instanceof ClientResponseError && (error.status === 400 || error.status === 404)) {
				return 'invalid';
			}

			throw error;
		}
	}

	async #createAccount(credentials: AccountSettings): Promise<void> {
		await pocketbase.collection('users').create(
			{
				id: credentials.userId,
				email: credentials.email,
				password: credentials.password,
				passwordConfirm: credentials.password
			},
			{ fetch }
		);
	}

	async #findBackupAccount(): Promise<AccountSettings | null> {
		const candidates = await settings.backup.findRestoreCandidates();

		for (const candidate of candidates) {
			if (candidate.settings.account.userId !== '') {
				return candidate.settings.account;
			}
		}

		return null;
	}

	/** Fire-and-forget bookkeeping after a successful login. */
	async #postLogin(): Promise<void> {
		const user = this.#user;

		if (!user) {
			return;
		}

		try {
			const version = await getVersion();
			await pocketbase.collection('users').update(
				user.id,
				{
					lastLogin: new Date(),
					meta: metaWithVersion(user.meta, version)
				},
				{ fetch }
			);
		} catch (error) {
			console.warn('[ACCOUNT]: Failed to update lastLogin:', error);
		}

		await this.#enrichFromSteam();
	}

	/** Fills in display name/avatar from the user's Steam profile when missing. */
	async #enrichFromSteam(): Promise<void> {
		const user = this.#user;

		if (!user || isEmpty(user.steamIds) || (user.name && !isEmpty(user.name))) {
			return;
		}

		try {
			const profile = await steam.getUserProfile(user.steamIds![0]);

			if (!profile) {
				return;
			}

			let avatar: File | undefined;

			if ((!user.avatar || isEmpty(user.avatar)) && !isEmpty(profile.avatarfull)) {
				try {
					const response = await fetch(profile.avatarfull);
					const blob = new Blob([await response.arrayBuffer()], {
						type: response.headers.get('Content-Type') || 'image/png'
					});
					avatar = new File([blob], 'avatar.png', { type: blob.type });
				} catch (error) {
					console.warn('[ACCOUNT]: Failed to download Steam avatar:', error);
				}
			}

			this.#user = (await pocketbase
				.collection('users')
				.update(user.id, { name: profile.personaname, avatar }, { fetch })) as User;
		} catch (error) {
			console.warn('[ACCOUNT]: Steam profile enrichment failed:', error);
		}
	}

	async refreshUser(): Promise<User> {
		const id = this.#user?.id ?? settings.tree.account.userId;
		const user = await pocketbase.collection('users').getOne<User>(id, { fetch });

		this.#user = user;
		await this.#syncLocalEmailFromUser();
		return user;
	}

	/** When email was confirmed on the website, keep local credentials in sync. */
	async #syncLocalEmailFromUser(): Promise<void> {
		const user = this.#user;
		if (!user?.email || this.isImpersonating) {
			return;
		}

		const current = settings.tree.account;
		if (user.email === current.email) {
			if (!current.pendingEmail) {
				return;
			}

			// Confirmed (or never pending for this address): clear stale pending.
			if (current.pendingEmail === user.email) {
				settings.tree.account = { ...current, pendingEmail: '' };
				await settings.persistNow();
			}

			return;
		}

		settings.tree.account = {
			...current,
			email: user.email,
			pendingEmail: ''
		};
		await settings.persistNow();
		await settings.backup.backupNow('email-sync');
	}

	/**
	 * Signs in as another user for the current session. Local credentials stay
	 * the admin account so {@link stopImpersonating} (and app restart) restore it.
	 */
	async impersonate(userId: string): Promise<User> {
		if (!this.isAdmin) {
			throw new Error(t('Only admins can impersonate users'));
		}

		if (!userId || userId === this.#user?.id) {
			throw new Error(t('You are already signed in as this user'));
		}

		const auth = (await pocketbase.send('/api/impersonate/' + userId, {
			method: 'POST',
			fetch
		})) as { token?: string; record?: User };

		if (!auth?.token || !auth.record) {
			throw new Error(t('Could not sign in as this user'));
		}

		pocketbase.authStore.save(auth.token, auth.record);
		this.#user = auth.record;
		return this.user;
	}

	/** Restores the stored admin credentials into the current session. */
	async stopImpersonating(): Promise<void> {
		if (!this.isImpersonating) {
			return;
		}

		const result = await this.#authenticate($state.snapshot(settings.tree.account));

		if (result !== 'ok') {
			throw new Error(t('Could not restore your account'));
		}
	}

	/** Links a Steam ID to the account (idempotent). */
	async attachSteamId(steamId: string): Promise<User> {
		if (this.isImpersonating) {
			return this.user;
		}

		const user = this.#user;

		if (!user) {
			throw new Error('No authenticated user to attach Steam ID to.');
		}

		if (user.steamIds?.includes(steamId)) {
			return this.user;
		}

		const version = await getVersion();
		this.#user = (await pocketbase.collection('users').update(
			user.id,
			{
				steamIds: uniq([...(user.steamIds || []), steamId]),
				meta: metaWithVersion(user.meta, version)
			},
			{ fetch }
		)) as User;

		void this.#enrichFromSteam();

		return this.user;
	}

	/**
	 * Updates display name and password on PocketBase and in local settings.
	 * Email changes use {@link requestEmailChange} (confirm on the website).
	 */
	async updateLoginCredentials({
		name,
		password
	}: {
		name?: string;
		password: string;
	}): Promise<string | null> {
		if (this.isImpersonating) {
			return t('Cannot change credentials while impersonating another user');
		}

		if (!this.isAuthenticated) {
			return t('Not signed in');
		}

		const current = settings.tree.account;
		const passwordChanged = password !== current.password;

		try {
			const updatePayload: Record<string, unknown> = {};

			if (name !== undefined) {
				updatePayload.name = name.trim();
			}

			if (passwordChanged) {
				updatePayload.oldPassword = current.password;
				updatePayload.password = password;
				updatePayload.passwordConfirm = password;
			}

			if (Object.keys(updatePayload).length > 0) {
				this.#user = (await pocketbase.collection('users').update(
					this.userId,
					updatePayload,
					{ fetch }
				)) as User;
			}

			if (passwordChanged) {
				settings.tree.account = { ...current, password };
				await settings.persistNow();
				await settings.backup.backupNow('change');

				const authResult = await this.#authenticate({
					...settings.tree.account
				});

				if (authResult !== 'ok') {
					return t('Credentials updated but re-authentication failed. Restart the app.');
				}
			}

			return null;
		} catch (error) {
			if (error instanceof ClientResponseError) {
				return fieldErrorMessage(error);
			}

			console.error('[ACCOUNT]: updateLoginCredentials failed:', error);

			return t('Failed to update account');
		}
	}

	async requestVerificationEmail(): Promise<string | null> {
		if (this.isImpersonating) {
			return t('Cannot change credentials while impersonating another user');
		}

		if (!this.isAuthenticated || !this.#user) {
			return t('Not signed in');
		}

		const email = this.#user.email;
		if (isPlaceholderEmail(email)) {
			return t('Set a real email address before verifying.');
		}

		const result = await api.auth.requestVerification(email);
		if (result.isErr()) {
			return t(result.error.message);
		}

		return null;
	}

	async requestEmailChange(newEmail: string): Promise<string | null> {
		if (this.isImpersonating) {
			return t('Cannot change credentials while impersonating another user');
		}

		if (!this.isAuthenticated || !this.#user) {
			return t('Not signed in');
		}

		if (!canRequestEmailChange(this.#user)) {
			return t('Verify your email before changing it.');
		}

		const result = await api.auth.requestEmailChange(newEmail);
		if (result.isErr()) {
			return t(result.error.message);
		}

		const trimmed = newEmail.trim();
		settings.tree.account = {
			...settings.tree.account,
			pendingEmail: trimmed
		};
		await settings.persistNow();

		return null;
	}

	get isEmailVerified(): boolean {
		return Boolean(this.#user?.verified);
	}

	get canChangeEmail(): boolean {
		if (!this.#user) {
			return false;
		}

		return canRequestEmailChange(this.#user);
	}

	get isPlaceholderEmail(): boolean {
		return this.#user ? isPlaceholderEmail(this.#user.email) : false;
	}

	get user() {
		return {
			...this.#user!,
			steamIds: this.#user?.steamIds || []
		};
	}

	/** Account credential settings slice (editable in dev). */
	get settings() {
		return settings.tree.account;
	}

	get isAuthenticated(): boolean {
		return this.status === 'authenticated' && this.#user !== null;
	}

	get isStaff(): boolean {
		const role = this.#user?.role;

		return role === UsersRoleOptions.admin || role === UsersRoleOptions.moderator;
	}

	get isAdmin(): boolean {
		return this.#user?.role === UsersRoleOptions.admin;
	}

	get isImpersonating(): boolean {
		return this.#user !== null && this.#user.id !== settings.tree.account.userId;
	}

	get userId(): string {
		return this.#user?.id ?? settings.tree.account.userId;
	}

	get email(): string {
		return this.#user?.email ?? settings.tree.account.email;
	}

	get password(): string {
		return settings.tree.account.password;
	}

	get avatarUrl(): string {
		return pocketbase.files.getURL(this.user, this.user.avatar);
	}
}

export const account = new AccountService();
