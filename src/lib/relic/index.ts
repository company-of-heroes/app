import type {
	LeaderBoardResponse,
	LeaderboardStatWithProfile,
	PersonalStat,
	RelicProfile
} from '@fknoobs/app';
import { fetch } from '@tauri-apps/plugin-http';

export const RELIC_API_BASE = 'https://coh1-lobby.reliclink.com';

export class RelicClient {
	private readonly baseUrl: string;
	private readonly defaultFetchOptions: RequestInit;

	/**
	 * Constructs a new RelicClient instance.
	 *
	 * @param baseUrl - Base URL for the Relic API
	 * @param tlsRejectUnauthorized - Whether to reject unauthorized TLS certificates
	 */
	constructor(baseUrl: string = RELIC_API_BASE, tlsRejectUnauthorized: boolean = false) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.defaultFetchOptions = {};
	}

	/**
	 * Fetches the personal stat for a given Steam ID.
	 *
	 * @param steamId - The Steam ID (string or bigint)
	 * @returns The matching StatMember or null if not found
	 */
	async getProfileBySteamId(steamId: string | bigint): Promise<RelicProfile | null> {
		const { leaderboardStats, statGroups } = await this.request<PersonalStat>(
			['community', 'leaderboard', 'getpersonalstat'],
			{
				title: 'coh1',
				profile_names: JSON.stringify([`/steam/${steamId}`])
			}
		);

		const members = statGroups?.[0]?.members ?? [];
		const member = members.find((m) => m.name === `/steam/${steamId}`);

		if (!member) {
			return null;
		}

		member.leaderboardStats = leaderboardStats.filter(
			(stat) => stat.statgroup_id === member.personal_statgroup_id
		);

		return member;
	}

	/**
	 * Fetches the personal stat for a given profile id.
	 *
	 * @param id - The profile id (number)
	 * @returns The matching StatMember or null if not found
	 */
	async getProfileById(id: number): Promise<RelicProfile | null> {
		const { leaderboardStats, statGroups } = await this.request<PersonalStat>(
			['community', 'leaderboard', 'getpersonalstat'],
			{
				title: 'coh1',
				profile_ids: JSON.stringify([id])
			}
		);

		const members = statGroups?.[0]?.members ?? [];
		const member = members.find((m) => m.profile_id === id);

		if (!member) {
			return null;
		}

		member.leaderboardStats = leaderboardStats.filter(
			(stat) => stat.statgroup_id === member.personal_statgroup_id
		);

		return member;
	}

	/**
	 * Fetches the personal stat for a given list of profile ids.
	 *
	 * @param ids - The profile ids (array of numbers)
	 * @returns The matching StatMembers or an empty array if not found
	 */
	async getProfileByIds(ids: number[]): Promise<RelicProfile[]> {
		const result = await this.request<PersonalStat>(
			['community', 'leaderboard', 'getpersonalstat'],
			{
				title: 'coh1',
				profile_ids: JSON.stringify(ids)
			}
		);

		const members = result.statGroups?.map((statGroup) => statGroup.members.at(0)!) ?? [];
		const filteredMembers = members.filter((m) => ids.includes(m.profile_id));

		// Add leaderboardStats to each member
		filteredMembers.forEach((member) => {
			member.leaderboardStats = result.leaderboardStats.filter(
				(stat) => stat.statgroup_id === member.personal_statgroup_id
			);
		});

		return filteredMembers;
	}

	/**
	 * Fetches the leaderboard stats for a given leaderboard ID.
	 *
	 * @param leaderboardId - The ID of the leaderboard to fetch
	 * @returns An array of LeaderboardStatWithMember objects
	 */
	async getLeaderboard(leaderboardId: number): Promise<LeaderboardStatWithProfile[]> {
		const result = await this.request<LeaderBoardResponse>(
			['community', 'leaderboard', 'getleaderboard2'],
			{
				title: 'coh1',
				leaderboard_id: leaderboardId
			}
		);

		const membersByStatGroupId = new Map(
			result.statGroups.flatMap((statGroup) =>
				statGroup.members.map((member) => [member.personal_statgroup_id, member])
			)
		);

		const leaderboardStatsWithMembers = result.leaderboardStats.map((leaderboardStat) => {
			const profile = membersByStatGroupId.get(leaderboardStat.statgroup_id);

			return {
				...leaderboardStat,
				profile: profile!
			};
		});

		return leaderboardStatsWithMembers;
	}

	public async getRecentMatchHistoryForProfile(profileId: number): Promise<any> {
		const result = await this.request<any>(
			['community', 'leaderboard', 'getrecentmatchhistorybyprofileid'],
			{
				title: 'coh1',
				profile_id: profileId
			}
		);

		return result;
	}

	/**
	 * Performs a GET request against the API.
	 *
	 * @param pathSegments - URL path segments (will be URL‐encoded)
	 * @param queryParams - Key/value pairs for URL query string
	 */
	private async request<T>(
		pathSegments: string[],
		queryParams: Record<string, string | number> = {}
	): Promise<T> {
		const url = new URL(`${this.baseUrl}/${pathSegments.map(encodeURIComponent).join('/')}`);

		Object.entries(queryParams).forEach(([key, value]) =>
			url.searchParams.set(key, value.toString())
		);

		console.log('Requesting URL:', url.toString());

		let response: Response;
		try {
			response = await fetch(url.toString(), {
				method: 'GET',
				danger: {
					acceptInvalidCerts: true,
					acceptInvalidHostnames: false
				}
			});
		} catch (err) {
			throw new RelicApiError('Network error while contacting Relic API', err);
		}

		if (!response.ok) {
			throw new RelicApiError(`Relic API returned HTTP ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as T;
	}
}

/**
 * Thrown when something goes wrong with the Relic API call.
 */
export class RelicApiError extends Error {
	public readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'RELIC_API_ERROR';
		this.cause = cause;
	}
}

export const relic = new RelicClient();
