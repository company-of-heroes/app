import type { AccountSettings } from '$core/config/schema';

/**
 * Account recovery decision tree (pure, fully testable).
 *
 * Guarantees:
 * - A new account is NEVER created silently while existing credentials might
 *   still be recoverable (backup restore is tried first, then the user is
 *   asked explicitly).
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
	/** Asks the user to confirm creating a brand new account (data loss for the old one). */
	confirmCreateNew(): Promise<boolean>;
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
	| { action: 'failed'; reason: 'declined' | 'error'; error?: string };

function hasCredentials(account: AccountSettings): boolean {
	return account.userId !== '' && account.email !== '' && account.password !== '';
}

function sameCredentials(a: AccountSettings, b: AccountSettings): boolean {
	return a.userId === b.userId && a.email === b.email && a.password === b.password;
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

			// Nothing recoverable: only create a new account with explicit consent.
			if (!(await ports.confirmCreateNew())) {
				return { action: 'failed', reason: 'declined' };
			}

			return await createNewAccount(ports);
		}

		// 2. No local credentials (fresh install): silently recover the user's
		// own account from a backup when possible.
		const backup = await ports.findBackupAccount();

		if (backup && hasCredentials(backup)) {
			if ((await ports.authenticate(backup)) === 'ok') {
				return {
					action: 'authenticated',
					credentials: backup,
					created: false,
					restoredFromBackup: true
				};
			}
		}

		// 3. Genuinely new user.
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
			error: 'Created account could not be authenticated'
		};
	}

	return { action: 'authenticated', credentials, created: true, restoredFromBackup: false };
}
