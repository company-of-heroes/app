import { describe, expect, it, vi } from 'vitest';
import { ensureAccountFlow, type RecoveryPorts } from './recovery';
import type { AccountSettings } from '$core/config/schema';

const LOCAL: AccountSettings = { userId: 'localuser123456', email: 'local@fknoobs.com', password: 'localpass' };
const BACKUP: AccountSettings = { userId: 'backupuser12345', email: 'backup@fknoobs.com', password: 'backuppass' };
const FRESH: AccountSettings = { userId: 'freshuser123456', email: 'fresh@fknoobs.com', password: 'freshpass' };
const EMPTY: AccountSettings = { userId: '', email: '', password: '' };

function makePorts(overrides: Partial<RecoveryPorts> = {}): RecoveryPorts {
	return {
		authenticate: vi.fn(async () => 'ok' as const),
		createAccount: vi.fn(async () => undefined),
		findBackupAccount: vi.fn(async () => null),
		confirmCreateNew: vi.fn(async () => false),
		generateCredentials: vi.fn(() => FRESH),
		...overrides
	};
}

describe('ensureAccountFlow', () => {
	it('authenticates with valid local credentials without touching anything else', async () => {
		const ports = makePorts();

		const outcome = await ensureAccountFlow(LOCAL, ports);

		expect(outcome).toEqual({
			action: 'authenticated',
			credentials: LOCAL,
			created: false,
			restoredFromBackup: false
		});
		expect(ports.findBackupAccount).not.toHaveBeenCalled();
		expect(ports.createAccount).not.toHaveBeenCalled();
	});

	it('recovers from backup credentials when local ones are rejected', async () => {
		const ports = makePorts({
			authenticate: vi.fn(async (creds: AccountSettings) =>
				creds.userId === BACKUP.userId ? ('ok' as const) : ('invalid' as const)
			),
			findBackupAccount: vi.fn(async () => BACKUP)
		});

		const outcome = await ensureAccountFlow(LOCAL, ports);

		expect(outcome).toEqual({
			action: 'authenticated',
			credentials: BACKUP,
			created: false,
			restoredFromBackup: true
		});
		expect(ports.createAccount).not.toHaveBeenCalled();
	});

	it('asks before creating a new account when nothing is recoverable', async () => {
		const ports = makePorts({
			authenticate: vi.fn(async (creds: AccountSettings) =>
				creds.userId === FRESH.userId ? ('ok' as const) : ('invalid' as const)
			),
			confirmCreateNew: vi.fn(async () => true)
		});

		const outcome = await ensureAccountFlow(LOCAL, ports);

		expect(ports.confirmCreateNew).toHaveBeenCalledOnce();
		expect(ports.createAccount).toHaveBeenCalledWith(FRESH);
		expect(outcome).toEqual({
			action: 'authenticated',
			credentials: FRESH,
			created: true,
			restoredFromBackup: false
		});
	});

	it('never creates an account when the user declines', async () => {
		const ports = makePorts({
			authenticate: vi.fn(async () => 'invalid' as const),
			confirmCreateNew: vi.fn(async () => false)
		});

		const outcome = await ensureAccountFlow(LOCAL, ports);

		expect(outcome).toEqual({ action: 'failed', reason: 'declined' });
		expect(ports.createAccount).not.toHaveBeenCalled();
	});

	it('does not retry identical backup credentials', async () => {
		const authenticate = vi.fn(async () => 'invalid' as const);
		const ports = makePorts({
			authenticate,
			findBackupAccount: vi.fn(async () => ({ ...LOCAL })),
			confirmCreateNew: vi.fn(async () => false)
		});

		await ensureAccountFlow(LOCAL, ports);

		// Only the initial attempt; identical credentials are not retried.
		expect(authenticate).toHaveBeenCalledTimes(1);
	});

	it('silently restores the account from backup on a fresh install', async () => {
		const ports = makePorts({
			findBackupAccount: vi.fn(async () => BACKUP)
		});

		const outcome = await ensureAccountFlow(EMPTY, ports);

		expect(outcome).toEqual({
			action: 'authenticated',
			credentials: BACKUP,
			created: false,
			restoredFromBackup: true
		});
		expect(ports.createAccount).not.toHaveBeenCalled();
	});

	it('creates a new account on a fresh install without backups', async () => {
		const ports = makePorts();

		const outcome = await ensureAccountFlow(EMPTY, ports);

		expect(ports.createAccount).toHaveBeenCalledWith(FRESH);
		expect(outcome).toMatchObject({ action: 'authenticated', created: true });
	});

	it('creates a new account when the fresh-install backup is stale', async () => {
		const ports = makePorts({
			authenticate: vi.fn(async (creds: AccountSettings) =>
				creds.userId === FRESH.userId ? ('ok' as const) : ('invalid' as const)
			),
			findBackupAccount: vi.fn(async () => BACKUP)
		});

		const outcome = await ensureAccountFlow(EMPTY, ports);

		expect(outcome).toMatchObject({ action: 'authenticated', created: true });
	});

	it('fails without creating anything on network errors', async () => {
		const ports = makePorts({
			authenticate: vi.fn(async () => {
				throw new Error('Network unreachable');
			})
		});

		const outcome = await ensureAccountFlow(LOCAL, ports);

		expect(outcome).toEqual({ action: 'failed', reason: 'error', error: 'Network unreachable' });
		expect(ports.createAccount).not.toHaveBeenCalled();
	});

	it('fails when account creation throws', async () => {
		const ports = makePorts({
			createAccount: vi.fn(async () => {
				throw new Error('email already exists');
			})
		});

		const outcome = await ensureAccountFlow(EMPTY, ports);

		expect(outcome).toEqual({ action: 'failed', reason: 'error', error: 'email already exists' });
	});
});
