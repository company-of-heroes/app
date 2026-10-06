import { ClientResponseError } from 'pocketbase';
import { cancel, onInvalidUrl, onUrl, start } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { fetch } from '$core/http/fetch';
import { getVersion } from '@tauri-apps/api/app';
import { isEmpty } from 'lodash-es';
import { pocketbase } from '$core/pocketbase';
import { UsersRoleOptions, type UsersResponse } from '$core/pocketbase/types';
import { settings } from '$core/config/settings.svelte';
import { accountSettingsSchema, type AccountSettings } from '$core/config/schema';
import { SITE_URL } from '$core/site/urls';
import { generatePassword, generateUniqueId } from '$lib/utils/password';
import { steam } from '$core/steam';
import { ensureAccountFlow, type AuthResult, type RecoveryOutcome } from './recovery';
import { t } from '$lib/i18n';
import { api } from '$core/api';
import { canRequestEmailChange, isPlaceholderEmail } from '@company-of-heroes/api';

export type User = UsersResponse<Record<string, any>, string[], Record<string, any>>;

export type AccountStatus = 'idle' | 'authenticating' | 'authenticated' | 'signed-out' | 'error';

/** Well inside PocketBase's one-week session lifetime. */
const SESSION_REFRESH_MS = 12 * 60 * 60 * 1000;
/** Loopback ports for the Steam login callback (the website allows exactly these). */
const LOGIN_PORTS = [8001, 8002, 8003, 8004, 8005];
/** How long the browser Steam login may take before the app stops listening. */
const STEAM_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function isAuthRejection(error: unknown): boolean {
	return error instanceof ClientResponseError && [400, 401, 403, 404].includes(error.status);
}

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
	/** Set only by {@link impersonate}; any real sign-in clears it. */
	#impersonating = $state(false);
	#conflictedSteamIds = new Set<string>();
	#refreshTimer: ReturnType<typeof setInterval> | null = null;

	status = $state<AccountStatus>('idle');
	lastError = $state<string | null>(null);

	/** True while the browser Steam login is waiting for its callback. */
	isSteamLoginPending = $state(false);
	#cancelSteamLogin: (() => void) | null = null;

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
			generateCredentials: () => ({
				userId: generateUniqueId(),
				email: crypto.randomUUID() + '@fknoobs.com',
				password: generatePassword(),
				pendingEmail: '',
				authMode: 'password',
				token: ''
			})
		});

		if (outcome.action === 'failed') {
			this.status = outcome.reason === 'signed-out' ? 'signed-out' : 'error';
			this.lastError =
				outcome.reason === 'signed-out'
					? settings.tree.account.authMode === 'session'
						? t('Your session has expired. Please sign in again.')
						: t('Your saved login no longer works. Please sign in again.')
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
		this.#startSessionRefresh();

		return outcome;
	}

	/** Sessions expire after a week; the app often runs longer than that. */
	#startSessionRefresh() {
		if (this.#refreshTimer) {
			return;
		}

		this.#refreshTimer = setInterval(() => void this.#refreshSession(), SESSION_REFRESH_MS);
	}

	/** Renews the session, or signs in again with the stored credentials when it cannot. */
	async #refreshSession() {
		if (this.isImpersonating) {
			return;
		}

		try {
			const auth = await pocketbase.collection('users').authRefresh<User>({ fetch });
			this.#user = auth.record;
			await this.#storeSessionToken(auth.token);
		} catch (error) {
			console.warn('[ACCOUNT]: session refresh failed, signing in again:', error);
			const result = await this.#authenticate($state.snapshot(settings.tree.account)).catch(
				(loginError) => {
					console.error('[ACCOUNT]: sign-in after refresh failed:', loginError);
					return 'invalid' as const;
				}
			);
			if (result !== 'ok') {
				const expired = settings.tree.account.authMode === 'session';
				this.status = expired ? 'signed-out' : 'error';
				this.lastError = expired
					? t('Your session has expired. Please sign in again.')
					: t('Could not restore your account');
			}
		}
	}

	async #authenticate(credentials: AccountSettings): Promise<AuthResult> {
		this.#impersonating = false;
		if (credentials.authMode === 'session') {
			return this.#resumeSession(credentials.token);
		}

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

	/** Continues a Steam login's session; a rejected token means the user signs in again. */
	async #resumeSession(token: string): Promise<AuthResult> {
		pocketbase.authStore.save(token, null);
		try {
			const auth = await pocketbase.collection('users').authRefresh<User>({ fetch });
			this.#user = auth.record;
			await this.#storeSessionToken(auth.token);
			return 'ok';
		} catch (error) {
			if (isAuthRejection(error)) {
				pocketbase.authStore.clear();
				return 'invalid';
			}

			throw error;
		}
	}

	/** Keeps the stored token current: an old one expires a week after it was issued. */
	async #storeSessionToken(token: string): Promise<void> {
		const current = settings.tree.account;
		if (current.authMode !== 'session' || current.token === token || this.isImpersonating) {
			return;
		}

		settings.tree.account = { ...current, token };
		await settings.persistNow();
	}

	/** Stores an existing account; the caller reloads so every service starts as that user. */
	async #useAccount(credentials: AccountSettings): Promise<void> {
		settings.tree.account = credentials;
		await settings.persistNow();
		await settings.backup.backupNow('change');
	}

	/** Signs in with an existing account's email and password. Returns an error message. */
	async loginWithPassword(email: string, password: string): Promise<string | null> {
		try {
			const auth = await pocketbase
				.collection('users')
				.authWithPassword<User>(email.trim(), password, { fetch });
			await this.#useAccount(
				accountSettingsSchema.parse({
					userId: auth.record.id,
					email: auth.record.email || email.trim(),
					password,
					authMode: 'password'
				})
			);
			return null;
		} catch (error) {
			if (isAuthRejection(error)) {
				return t('Invalid email or password.');
			}

			console.error('[ACCOUNT]: password login failed:', error);
			return t('Could not sign in. Please try again.');
		}
	}

	/** Creates a personal account with the user's own email and password. Returns an error message. */
	async register(email: string, password: string): Promise<string | null> {
		const result = await api.auth.register(email, password);
		if (result.isErr()) {
			return t(result.error.message);
		}

		await this.#useAccount(
			accountSettingsSchema.parse({
				userId: result.value.id,
				email: result.value.email || email.trim(),
				password,
				authMode: 'password'
			})
		);
		return null;
	}

	/**
	 * Signs in with Steam: the website runs the Steam login in the browser and sends a
	 * short-lived code back to a loopback port, which the app trades for a session.
	 */
	async loginWithSteam(): Promise<{ error: string | null; cancelled?: boolean }> {
		this.isSteamLoginPending = true;
		const unlisten: Array<() => void> = [];
		let port: number | null = null;
		let timer: ReturnType<typeof setTimeout> | null = null;
		try {
			port = await start({ ports: LOGIN_PORTS });
			const origin = `http://localhost:${port}`;
			const result = await new Promise<{ code?: string; error?: string } | null>((resolve) => {
				this.#cancelSteamLogin = () => resolve(null);
				timer = setTimeout(
					() => resolve({ error: t('Steam login timed out.') }),
					STEAM_LOGIN_TIMEOUT_MS
				);
				void onUrl((raw) => {
					const params = new URL(raw).searchParams;
					const code = params.get('code');
					resolve(code ? { code } : { error: params.get('error') || t('Steam login failed.') });
				}).then((off) => unlisten.push(off));
				void onInvalidUrl(() => resolve({ error: t('Steam login failed.') })).then((off) =>
					unlisten.push(off)
				);
				const url = new URL('/auth/steam/start', SITE_URL);
				url.searchParams.set('origin', origin);
				void openUrl(url.toString());
			});

			if (!result) {
				return { error: null, cancelled: true };
			}

			if (!result.code) {
				return { error: result.error ?? t('Steam login failed.') };
			}

			const exchanged = await api.auth.exchangeHandoffCode(result.code);
			if (exchanged.isErr()) {
				return { error: t(exchanged.error.message) };
			}

			const { token, record } = exchanged.value;
			pocketbase.authStore.save(token, record);
			await this.#useAccount(
				accountSettingsSchema.parse({
					userId: record.id,
					email: record.email ?? '',
					authMode: 'session',
					token
				})
			);
			return { error: null };
		} catch (error) {
			console.error('[ACCOUNT]: Steam login failed:', error);
			return { error: t('Steam login failed.') };
		} finally {
			if (timer) {
				clearTimeout(timer);
			}

			unlisten.forEach((off) => off());
			if (port !== null) {
				void cancel(port);
			}

			this.#cancelSteamLogin = null;
			this.isSteamLoginPending = false;
		}
	}

	/** Stops waiting for the browser Steam login. */
	cancelSteamLogin(): void {
		this.#cancelSteamLogin?.();
	}

	/** Forgets the stored account; the caller reloads into the setup's sign-in step. */
	async signOut(): Promise<void> {
		pocketbase.authStore.clear();
		this.#user = null;
		this.#impersonating = false;
		this.status = 'idle';
		settings.tree.account = accountSettingsSchema.parse({});
		await settings.persistNow();
	}

	/** Signed in with Steam: there is no password to show or change. */
	get isSessionLogin(): boolean {
		return settings.tree.account.authMode === 'session';
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

	/** Fills in display name and avatar from the user's Steam profile, each when missing. */
	async #enrichFromSteam(): Promise<void> {
		const user = this.#user;

		if (!user || isEmpty(user.steamIds) || this.isImpersonating) {
			return;
		}

		const needsName = isEmpty(user.name?.trim());
		const needsAvatar = isEmpty(user.avatar);
		if (!needsName && !needsAvatar) {
			return;
		}

		try {
			const profile = await steam.getUserProfile(user.steamIds![0]);

			if (!profile) {
				return;
			}

			let avatar: File | undefined;

			if (needsAvatar && !isEmpty(profile.avatarfull)) {
				try {
					const response = await fetch(profile.avatarfull);
					if (!response.ok) {
						throw new Error(`HTTP ${response.status}`);
					}

					const blob = new Blob([await response.arrayBuffer()], {
						type: response.headers.get('Content-Type') || 'image/png'
					});
					avatar = new File([blob], 'avatar.png', { type: blob.type });
				} catch (error) {
					console.warn('[ACCOUNT]: Failed to download Steam avatar:', error);
				}
			}

			const update: { name?: string; avatar?: File } = {};
			if (needsName && !isEmpty(profile.personaname)) {
				update.name = profile.personaname;
			}

			if (avatar) {
				update.avatar = avatar;
			}

			if (isEmpty(update)) {
				return;
			}

			this.#user = (await pocketbase
				.collection('users')
				.update(user.id, update, { fetch })) as User;
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

		// Dynamic: $core/api imports this module.
		const { siteApi } = await import('$core/api');
		const auth = await siteApi<{ token?: string; record?: User }>(
			`/impersonate/${encodeURIComponent(userId)}`,
			{
				method: 'POST'
			}
		);

		if (!auth?.token || !auth.record) {
			throw new Error(t('Could not sign in as this user'));
		}

		pocketbase.authStore.save(auth.token, auth.record);
		this.#user = auth.record;
		this.#impersonating = true;
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

	/**
	 * Links a Steam ID to the account through the website (idempotent). Returns an error
	 * message once per session when another account already owns the ID.
	 */
	async attachSteamId(steamId: string): Promise<string | null> {
		if (this.isImpersonating) {
			return null;
		}

		const user = this.#user;

		if (!user) {
			throw new Error('No authenticated user to attach Steam ID to.');
		}

		if (user.steamIds?.includes(steamId) || this.#conflictedSteamIds.has(steamId)) {
			return null;
		}

		const result = await api.auth.linkSteamId(steamId);
		if (result.isErr()) {
			if (result.error.status !== 409) {
				throw new Error(result.error.message);
			}

			this.#conflictedSteamIds.add(steamId);
			return t(result.error.message);
		}

		this.#user = { ...user, steamIds: result.value.steamIds } as User;
		void this.#enrichFromSteam();

		return null;
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
		// Steam sessions have no known password; PocketBase needs the old one to change it.
		const passwordChanged = current.authMode !== 'session' && password !== current.password;

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
				this.#user = (await pocketbase
					.collection('users')
					.update(this.userId, updatePayload, { fetch })) as User;
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
		return this.#impersonating;
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
