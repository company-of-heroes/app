import Sqlite from '@tauri-apps/plugin-sql';
import { Lobbies } from './lobbies';
import { dev } from '$app/environment';

export class Database {
	public lobbies: Lobbies;

	private constructor(private client: Sqlite) {
		this.lobbies = new Lobbies(client);
	}

	/**
	 * Loads the database from the given data source name (DSN).
	 *
	 * @param dsn The data source name for the database connection.
	 * @returns A promise that resolves to the Database instance.
	 * @example
	 *
	 * const db = await Database.load('sqlite:test.db');
	 */
	static async load(): Promise<Database> {
		return new Database(await Sqlite.load(dev ? 'sqlite:app.dev.db' : 'sqlite:app.db'));
	}
}
