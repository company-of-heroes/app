import type { AccountSettings } from '$core/config/schema';
import { t } from '$lib/i18n';

/**
 * Account recovery decision tree (pure, fully testable).
 *
 * Guarantees:
 * - A new account is NEVER created while existing credentials might still be
 *   recoverable: backups are tried first, then the user signs in again (or
 *   picks an anonymous account on the sign-in screen).
 * - Network errors never lead to account creation; they fail the flow so the
 *   caller can retry.
 */

export type AuthResult = 'ok' | 'invalid';

export type RecoveryPorts = {
	/** Attempts a PocketBase login. Returns 'invalid' for bad credentials/missing user; throws on network errors. */
	authenticate(credentials: AccountSettings): Promise<AuthResult>;
	/** Creates a new PocketBase user with the given credentials. Throws on failure. */
	createAccount(credentials: AccountSettings): Promise<void>;
	/** Finds account credentials in external backups, if any. */
	findBackupAccount(): Promise<AccountSettings | null>;
	/** Generates fresh random credentials. */
	generateCredentials(): AccountSettings;
};

export type RecoveryOutcome =
	| {
			action: 'authenticated';
			credentials: AccountSettings;
			created: boolean;
			restoredFromBackup: boolean;
	  }
	| { action: 'failed'; reason: 'error' | 'signed-out'; error?: string };

/** A password login, or a Steam login's session token. */
export function hasCredentials(account: AccountSettings): boolean {
	if (account.userId === '') {
		return false;
	}

	if (account.authMode === 'session') {
		return account.token !== '';
	}

	return account.email !== '' && account.password !== '';
}

function sameCredentials(a: AccountSettings, b: AccountSettings): boolean {
	return (
		a.userId === b.userId && a.email === b.email && a.password === b.password && a.token === b.token
	);
}

export async function ensureAccountFlow(
	current: AccountSettings,
	ports: RecoveryPorts
): Promise<RecoveryOutcome> {
	try {
		// 1. Existing local credentials
		if (hasCredentials(current)) {
			if ((await ports.authenticate(current)) === 'ok') {
				return {
					action: 'authenticated',
					credentials: current,
					created: false,
					restoredFromBackup: false
				};
			}

			// Local credentials rejected: try backup credentials before anything else.
			const backup = await ports.findBackupAccount();

			if (backup && hasCredentials(backup) && !sameCredentials(backup, current)) {
				if ((await ports.authenticate(backup)) === 'ok') {
					return {
						action: 'authenticated',
						credentials: backup,
						created: false,
						restoredFromBackup: true
					};
				}
			}

			// Nothing recoverable: back to the sign-in screen, never a new account.
			return { action: 'failed', reason: 'signed-out' };
		}

		// 2. No local credentials: the user chose "Create anonymous account" on the
		// sign-in screen (boot already restored a backup on fresh installs).
		return await createNewAccount(ports);
	} catch (error) {
		return {
			action: 'failed',
			reason: 'error',
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

async function createNewAccount(ports: RecoveryPorts): Promise<RecoveryOutcome> {
	const credentials = ports.generateCredentials();

	await ports.createAccount(credentials);

	if ((await ports.authenticate(credentials)) !== 'ok') {
		return {
			action: 'failed',
			reason: 'error',
			error: t('Created account could not be authenticated')
		};
	}

	return { action: 'authenticated', credentials, created: true, restoredFromBackup: false };
}
