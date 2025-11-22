import Sqlite from '@tauri-apps/plugin-sql';

/**
 * Raw database row representation with JSON stored as string.
 * This interface matches the actual SQLite table structure where booleans are stored as integers.
 *
 * @interface LobbyRow
 */
interface LobbyRow {
	id: number;
	sessionId: number;
	isRanked: number; // SQLite stores boolean as 0 or 1
	map: string;
	outcome?: string;
	matchType: number;
	players: string;
	createdAt: string; // SQLite DATETIME stored as string
	updatedAt: string; // SQLite DATETIME stored as string
}

/**
 * Parsed lobby interface with automatic type conversions.
 * - players: JSON string parsed to object
 * - isRanked: number (0/1) converted to boolean
 * - createdAt/updatedAt: string converted to Date
 *
 * @interface Lobby
 */
export interface Lobby {
	id: number;
	sessionId: number;
	isRanked: boolean;
	map: string;
	outcome?: string;
	matchType: number;
	players: any;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Filter options for querying lobbies.
 * All fields are optional and can be combined for complex queries.
 *
 * @interface LobbyFilters
 */
export interface LobbyFilters {
	/** Filter by exact session ID */
	sessionId?: number;
	/** Filter by ranked status */
	isRanked?: boolean;
	/** Filter by map name (supports partial matches) */
	map?: string;
	/** Filter by exact outcome */
	outcome?: string;
	/** Filter by exact match type */
	matchType?: number;
	/** Search term applied across map, outcome, and players fields */
	searchTerm?: string;
	/** Search for player name within players JSON */
	playerName?: string;
	/** Filter by creation date (format: YYYY-MM-DD) */
	createdDate?: string;
	/** Filter by date range - start date (format: YYYY-MM-DD) */
	createdAfter?: string;
	/** Filter by date range - end date (format: YYYY-MM-DD) */
	createdBefore?: string;
}

/**
 * Pagination and sorting options for query results.
 *
 * @interface PaginationOptions
 */
export interface PaginationOptions {
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip */
	offset?: number;
	/** Field to sort by */
	sortBy?: keyof LobbyRow;
	/** Sort direction */
	sortOrder?: 'ASC' | 'DESC';
}

/**
 * Database access layer for lobby management.
 * Provides complete CRUD operations with automatic JSON parsing/stringifying.
 *
 * @class Lobbies
 */
export class Lobbies {
	/**
	 * Creates an instance of Lobbies.
	 *
	 * @constructor
	 * @param {Sqlite} client - SQLite database client instance
	 */
	constructor(private client: Sqlite) {}

	/**
	 * Parses a single database row, converting types from SQLite format to TypeScript.
	 * - Converts players JSON string to object
	 * - Converts isRanked from number (0/1) to boolean
	 * - Converts date strings to Date objects
	 *
	 * @private
	 * @param {LobbyRow} row - Raw database row
	 * @returns {Lobby} Parsed lobby with proper TypeScript types
	 */
	private parseRow(row: LobbyRow): Lobby {
		return {
			id: row.id,
			sessionId: row.sessionId,
			isRanked: Boolean(row.isRanked),
			map: row.map,
			outcome: row.outcome,
			matchType: row.matchType,
			players: JSON.parse(row.players),
			createdAt: new Date(row.createdAt),
			updatedAt: new Date(row.updatedAt)
		};
	}

	/**
	 * Parses multiple database rows, converting players JSON strings to objects.
	 *
	 * @private
	 * @param {LobbyRow[]} rows - Array of raw database rows
	 * @returns {Lobby[]} Array of parsed lobbies
	 */
	private parseRows(rows: LobbyRow[]): Lobby[] {
		return rows.map((row) => this.parseRow(row));
	}

	/**
	 * Converts a Lobby object to database-compatible format.
	 * - Converts boolean isRanked to number (0/1)
	 * - Stringifies players object to JSON
	 *
	 * @private
	 * @param {Partial<Lobby>} lobby - Lobby data to convert
	 * @returns {any} Database-compatible lobby object
	 */
	private toDbFormat(lobby: Partial<Lobby>): any {
		const dbLobby: any = { ...lobby };

		// Convert boolean to number for SQLite
		if ('isRanked' in dbLobby && typeof dbLobby.isRanked === 'boolean') {
			dbLobby.isRanked = dbLobby.isRanked ? 1 : 0;
		}

		// Stringify players JSON
		if ('players' in dbLobby && dbLobby.players) {
			dbLobby.players =
				typeof dbLobby.players === 'string' ? dbLobby.players : JSON.stringify(dbLobby.players);
		}

		return dbLobby;
	}

	/**
	 * Creates a new lobby record in the database.
	 *
	 * @public
	 * @async
	 * @param {Omit<Lobby, 'id' | 'createdAt' | 'updatedAt'>} lobby - Lobby data to insert
	 * @returns {Promise<void>}
	 * @throws {Error} If sessionId already exists
	 */
	async create(lobby: Omit<Lobby, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
		const dbLobby = this.toDbFormat(lobby);
		const keys = Object.keys(dbLobby).join(', ');
		const placeholders = Object.keys(dbLobby)
			.map(() => '?')
			.join(', ');
		const values = Object.values(dbLobby);
		await this.client.execute(`INSERT INTO lobbies (${keys}) VALUES (${placeholders})`, values);
	}

	/**
	 * Creates a new lobby or updates an existing one based on sessionId.
	 * If sessionId exists, updates all fields except id, createdAt, and sessionId.
	 *
	 * @public
	 * @async
	 * @param {Omit<Lobby, 'id' | 'createdAt' | 'updatedAt'>} lobby - Lobby data to insert or update
	 * @returns {Promise<void>}
	 */
	async createOrUpdate(lobby: Omit<Lobby, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
		const dbLobby = this.toDbFormat(lobby);
		const keys = Object.keys(dbLobby).join(', ');
		const placeholders = Object.keys(dbLobby)
			.map(() => '?')
			.join(', ');
		const values = Object.values(dbLobby);
		await this.client.execute(
			`INSERT INTO lobbies (${keys}) VALUES (${placeholders})
            ON CONFLICT(sessionId) DO UPDATE SET
            isRanked=excluded.isRanked,
            map=excluded.map,
            outcome=excluded.outcome,
            matchType=excluded.matchType,
            players=excluded.players,
            updatedAt=CURRENT_TIMESTAMP`,
			values
		);
	}

	/**
	 * Retrieves a single lobby by its primary key ID.
	 *
	 * @public
	 * @async
	 * @param {number} id - Primary key ID of the lobby
	 * @returns {Promise<Lobby | null>} Lobby if found, null otherwise
	 */
	async getById(id: number): Promise<Lobby | null> {
		const rows = await this.client.select<LobbyRow[]>('SELECT * FROM lobbies WHERE id = ?', [id]);
		return rows.length > 0 ? this.parseRow(rows[0]) : null;
	}

	/**
	 * Retrieves a single lobby by its unique session ID.
	 *
	 * @public
	 * @async
	 * @param {number} sessionId - Unique session identifier
	 * @returns {Promise<Lobby | null>} Lobby if found, null otherwise
	 */
	async getBySessionId(sessionId: number): Promise<Lobby | null> {
		const rows = await this.client.select<LobbyRow[]>('SELECT * FROM lobbies WHERE sessionId = ?', [
			sessionId
		]);
		return rows.length > 0 ? this.parseRow(rows[0]) : null;
	}

	/**
	 * Retrieves all lobbies with optional pagination and sorting.
	 *
	 * @public
	 * @async
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of all lobbies matching criteria
	 */
	async getAll(options?: PaginationOptions): Promise<Lobby[]> {
		let query = 'SELECT * FROM lobbies';
		const params: any[] = [];

		if (options?.sortBy) {
			query += ` ORDER BY ${options.sortBy} ${options.sortOrder || 'ASC'}`;
		}

		if (options?.limit) {
			query += ' LIMIT ?';
			params.push(options.limit);
		}

		if (options?.offset) {
			query += ' OFFSET ?';
			params.push(options.offset);
		}

		const rows = await this.client.select<LobbyRow[]>(query, params);
		return this.parseRows(rows);
	}

	/**
	 * Counts the total number of lobbies matching the given filters.
	 *
	 * @public
	 * @async
	 * @param {LobbyFilters} [filters] - Optional filters to apply
	 * @returns {Promise<number>} Total count of matching lobbies
	 */
	async count(filters?: LobbyFilters): Promise<number> {
		let query = 'SELECT COUNT(*) as count FROM lobbies';
		const params: any[] = [];

		if (filters) {
			const whereClauses = this.buildWhereClause(filters, params);
			if (whereClauses.length > 0) {
				query += ' WHERE ' + whereClauses.join(' AND ');
			}
		}

		const result = await this.client.select<{ count: number }[]>(query, params);
		return result[0]?.count || 0;
	}

	/**
	 * Filters lobbies based on multiple criteria with pagination and sorting support.
	 * All filter fields are combined using AND logic.
	 *
	 * @public
	 * @async
	 * @param {LobbyFilters} filters - Filter criteria to apply
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies matching all filter criteria
	 */
	async filter(filters: LobbyFilters, options?: PaginationOptions): Promise<Lobby[]> {
		let query = 'SELECT * FROM lobbies';
		const params: any[] = [];

		const whereClauses = this.buildWhereClause(filters, params);
		if (whereClauses.length > 0) {
			query += ' WHERE ' + whereClauses.join(' AND ');
		}

		if (options?.sortBy) {
			query += ` ORDER BY ${options.sortBy} ${options.sortOrder || 'ASC'}`;
		}

		if (options?.limit) {
			query += ' LIMIT ?';
			params.push(options.limit);
		}

		if (options?.offset) {
			query += ' OFFSET ?';
			params.push(options.offset);
		}

		const rows = await this.client.select<LobbyRow[]>(query, params);
		return this.parseRows(rows);
	}

	/**
	 * Builds SQL WHERE clause components from filter options.
	 * Populates the params array with corresponding values.
	 *
	 * @private
	 * @param {LobbyFilters} filters - Filter criteria
	 * @param {any[]} params - Array to populate with query parameters
	 * @returns {string[]} Array of WHERE clause strings
	 */
	private buildWhereClause(filters: LobbyFilters, params: any[]): string[] {
		const whereClauses: string[] = [];

		if (filters.sessionId !== undefined) {
			whereClauses.push('sessionId = ?');
			params.push(filters.sessionId);
		}

		if (filters.isRanked !== undefined) {
			whereClauses.push('isRanked = ?');
			params.push(filters.isRanked ? 1 : 0);
		}

		if (filters.map) {
			whereClauses.push('map LIKE ?');
			params.push(`%${filters.map}%`);
		}

		if (filters.outcome) {
			whereClauses.push('outcome = ?');
			params.push(filters.outcome);
		}

		if (filters.matchType !== undefined) {
			whereClauses.push('matchType = ?');
			params.push(filters.matchType);
		}

		if (filters.playerName) {
			whereClauses.push('players LIKE ?');
			params.push(`%${filters.playerName}%`);
		}

		if (filters.searchTerm) {
			whereClauses.push('(map LIKE ? OR outcome LIKE ? OR players LIKE ?)');
			params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
		}

		if (filters.createdDate) {
			whereClauses.push('DATE(createdAt) = ?');
			params.push(filters.createdDate);
		}

		if (filters.createdAfter) {
			whereClauses.push('DATE(createdAt) >= ?');
			params.push(filters.createdAfter);
		}

		if (filters.createdBefore) {
			whereClauses.push('DATE(createdAt) <= ?');
			params.push(filters.createdBefore);
		}

		return whereClauses;
	}

	/**
	 * Searches for lobbies by map name using partial matching.
	 *
	 * @public
	 * @async
	 * @param {string} map - Map name to search for (supports partial matches)
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies with matching map names
	 */
	async searchByMap(map: string, options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ map }, options);
	}

	/**
	 * Searches for lobbies containing a specific player name in the players JSON.
	 * Uses text search on the JSON string, so it will match any occurrence.
	 *
	 * @public
	 * @async
	 * @param {string} playerName - Player name to search for
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies containing the player
	 */
	async searchByPlayer(playerName: string, options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ playerName }, options);
	}

	/**
	 * Performs a general search across map, outcome, and players fields.
	 * The search term is applied to all fields using OR logic.
	 *
	 * @public
	 * @async
	 * @param {string} searchTerm - Term to search for across multiple fields
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies matching the search term
	 */
	async search(searchTerm: string, options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ searchTerm }, options);
	}

	/**
	 * Updates a lobby by its primary key ID.
	 * Automatically updates the updatedAt timestamp.
	 *
	 * @public
	 * @async
	 * @param {number} id - Primary key ID of the lobby to update
	 * @param {Partial<Omit<Lobby, 'id' | 'createdAt'>>} updates - Fields to update
	 * @returns {Promise<void>}
	 */
	async updateById(id: number, updates: Partial<Omit<Lobby, 'id' | 'createdAt'>>): Promise<void> {
		const dbUpdates = this.toDbFormat(updates);
		const setClauses = Object.keys(dbUpdates)
			.map((key) => `${key} = ?`)
			.join(', ');
		const values = [...Object.values(dbUpdates), id];

		await this.client.execute(
			`UPDATE lobbies SET ${setClauses}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
			values
		);
	}

	/**
	 * Updates a lobby by its unique session ID.
	 * Automatically updates the updatedAt timestamp.
	 *
	 * @public
	 * @async
	 * @param {number} sessionId - Unique session identifier
	 * @param {Partial<Omit<Lobby, 'id' | 'sessionId' | 'createdAt'>>} updates - Fields to update
	 * @returns {Promise<void>}
	 */
	async updateBySessionId(
		sessionId: number,
		updates: Partial<Omit<Lobby, 'id' | 'sessionId' | 'createdAt'>>
	): Promise<void> {
		const dbUpdates = this.toDbFormat(updates);
		const setClauses = Object.keys(dbUpdates)
			.map((key) => `${key} = ?`)
			.join(', ');
		const values = [...Object.values(dbUpdates), sessionId];

		await this.client.execute(
			`UPDATE lobbies SET ${setClauses}, updatedAt = CURRENT_TIMESTAMP WHERE sessionId = ?`,
			values
		);
	}

	/**
	 * Deletes a lobby by its primary key ID.
	 *
	 * @public
	 * @async
	 * @param {number} id - Primary key ID of the lobby to delete
	 * @returns {Promise<void>}
	 */
	async deleteById(id: number): Promise<void> {
		await this.client.execute('DELETE FROM lobbies WHERE id = ?', [id]);
	}

	/**
	 * Deletes a lobby by its unique session ID.
	 *
	 * @public
	 * @async
	 * @param {number} sessionId - Unique session identifier
	 * @returns {Promise<void>}
	 */
	async deleteBySessionId(sessionId: number): Promise<void> {
		await this.client.execute('DELETE FROM lobbies WHERE sessionId = ?', [sessionId]);
	}

	/**
	 * Deletes all lobby records from the database.
	 * Use with caution as this operation cannot be undone.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	async deleteAll(): Promise<void> {
		await this.client.execute('DELETE FROM lobbies');
	}

	/**
	 * Deletes lobbies matching the specified filter criteria.
	 * All filter fields are combined using AND logic.
	 *
	 * @public
	 * @async
	 * @param {LobbyFilters} filters - Filter criteria for deletion
	 * @returns {Promise<void>}
	 */
	async deleteWhere(filters: LobbyFilters): Promise<void> {
		let query = 'DELETE FROM lobbies';
		const params: any[] = [];

		const whereClauses = this.buildWhereClause(filters, params);
		if (whereClauses.length > 0) {
			query += ' WHERE ' + whereClauses.join(' AND ');
		}

		await this.client.execute(query, params);
	}

	/**
	 * Retrieves only ranked lobbies with optional pagination and sorting.
	 *
	 * @public
	 * @async
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of ranked lobbies
	 */
	async getRanked(options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ isRanked: true }, options);
	}

	/**
	 * Retrieves only unranked lobbies with optional pagination and sorting.
	 *
	 * @public
	 * @async
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of unranked lobbies
	 */
	async getUnranked(options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ isRanked: false }, options);
	}

	/**
	 * Retrieves lobbies filtered by match type with optional pagination and sorting.
	 *
	 * @public
	 * @async
	 * @param {number} matchType - Match type identifier
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies with the specified match type
	 */
	async getByMatchType(matchType: number, options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ matchType }, options);
	}

	/**
	 * Retrieves the most recently created lobbies.
	 * Results are sorted by creation date in descending order.
	 *
	 * @public
	 * @async
	 * @param {number} [limit=10] - Maximum number of lobbies to return
	 * @returns {Promise<Lobby[]>} Array of recent lobbies
	 */
	async getRecent(limit: number = 10): Promise<Lobby[]> {
		return this.getAll({ limit, sortBy: 'createdAt', sortOrder: 'DESC' });
	}

	/**
	 * Retrieves lobbies created on a specific date.
	 * Date should be in YYYY-MM-DD format.
	 *
	 * @public
	 * @async
	 * @param {string} date - Date in YYYY-MM-DD format
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies created on the specified date
	 * @example
	 * // Get all lobbies from January 1, 2025
	 * await lobbies.getByDate('2025-01-01');
	 */
	async getByDate(date: string, options?: PaginationOptions): Promise<Lobby[]> {
		return this.filter({ createdDate: date }, options);
	}

	/**
	 * Retrieves lobbies created within a date range.
	 * Dates should be in YYYY-MM-DD format.
	 *
	 * @public
	 * @async
	 * @param {string} startDate - Start date in YYYY-MM-DD format (inclusive)
	 * @param {string} endDate - End date in YYYY-MM-DD format (inclusive)
	 * @param {PaginationOptions} [options] - Optional pagination and sorting parameters
	 * @returns {Promise<Lobby[]>} Array of lobbies created within the date range
	 * @example
	 * // Get all lobbies from January 2025
	 * await lobbies.getByDateRange('2025-01-01', '2025-01-31');
	 */
	async getByDateRange(
		startDate: string,
		endDate: string,
		options?: PaginationOptions
	): Promise<Lobby[]> {
		return this.filter({ createdAfter: startDate, createdBefore: endDate }, options);
	}
}
