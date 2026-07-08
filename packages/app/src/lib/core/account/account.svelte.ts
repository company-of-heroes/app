import { ClientResponseError } from 'pocketbase';
import { fetch } from '@tauri-apps/plugin-http';
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

export type User = UsersResponse<Record<string, any>, string[]>;

export type AccountStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

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
					'Your account could not be found and no working backup was detected.\n\n' +
						'Do you want to create a new account? Your previous match history will no longer be linked.',
					{ okLabel: 'Create new account', cancelLabel: 'Cancel', kind: 'warning' }
				),
			generateCredentials: () => ({
				userId: generateUniqueId(),
				email: crypto.randomUUID() + '@fknoobs.com',
				password: generatePassword()
			})
		});

		if (outcome.action === 'failed') {
			this.status = 'error';
			this.lastError =
				outcome.reason === 'declined'
					? 'Account setup cancelled'
					: (outcome.error ?? 'Unknown account error');
			console.error('[ACCOUNT]: ensureAccount failed:', outcome);
			return outcome;
		}

		// Persist (possibly restored/new) credentials.
		const changed =
			settings.tree.account.userId !== outcome.credentials.userId ||
			settings.tree.account.email !== outcome.credentials.email ||
			settings.tree.account.password !== outcome.credentials.password;

		if (changed) {
			settings.tree.account = { ...outcome.credentials };
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
		try {
			const auth = await pocketbase
				.collection('users')
				.authWithPassword<User>(credentials.email, credentials.password, { fetch });

			this.#user = auth.record;
			return 'ok';
		} catch (error) {
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
			await pocketbase.collection('users').update(
				user.id,
				{
					lastLogin: new Date(),
					meta: { version: await getVersion() }
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
		const user = await pocketbase
			.collection('users')
			.getOne<User>(settings.tree.account.userId, { fetch });

		this.#user = user;
		return user;
	}

	/** Links a Steam ID to the account (idempotent). */
	async attachSteamId(steamId: string): Promise<User> {
		const user = this.#user;

		if (!user) {
			throw new Error('No authenticated user to attach Steam ID to.');
		}

		if (user.steamIds?.includes(steamId)) {
			return this.user;
		}

		this.#user = (await pocketbase
			.collection('users')
			.update(user.id, { steamIds: uniq([...(user.steamIds || []), steamId]) }, { fetch })) as User;

		void this.#enrichFromSteam();

		return this.user;
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

	get userId(): string {
		return settings.tree.account.userId;
	}

	get email(): string {
		return settings.tree.account.email;
	}

	get password(): string {
		return settings.tree.account.password;
	}

	get avatarUrl(): string {
		return pocketbase.files.getURL(this.user, this.user.avatar);
	}
}

export const account = new AccountService();
