import type { MatchHistoryPlayer, OriginalMatchHistory, TransformedMatch } from '@fknoobs/app';

export function transformMatchHistory(
	data: OriginalMatchHistory,
	profileId: number
): TransformedMatch[] {
	// Create a map of profiles for quick lookup
	const profileMap = new Map(data.profiles.map((profile) => [profile.profile_id, profile]));

	return data.matchHistoryStats.map((match) => {
		// Create maps for quick lookup of match data
		const reportResultsMap = new Map(
			match.matchhistoryreportresults.map((result) => [result.profile_id, result])
		);

		const memberMap = new Map(
			match.matchhistorymember.map((member) => [member.profile_id, member])
		);

		// Combine all player data
		const players: MatchHistoryPlayer[] = match.matchhistorymember.map((member) => {
			const profile = profileMap.get(member.profile_id);
			const reportResult = reportResultsMap.get(member.profile_id);

			if (!profile || !reportResult) {
				throw new Error(`Missing data for profile_id: ${member.profile_id}`);
			}

			return {
				// Profile data
				profile_id: profile.profile_id,
				name: profile.name,
				alias: profile.alias,
				personal_statgroup_id: profile.personal_statgroup_id,
				xp: profile.xp,
				level: profile.level,
				leaderboardregion_id: profile.leaderboardregion_id,
				country: profile.country,
				steamId: profile.name.replace('/steam/', ''),

				// Report results
				resulttype: reportResult.resulttype,
				teamid: reportResult.teamid,
				race_id: reportResult.race_id,
				xpgained: reportResult.xpgained,
				counters: reportResult.counters,
				matchstartdate: reportResult.matchstartdate,

				// Member data
				statgroup_id: member.statgroup_id,
				wins: member.wins,
				losses: member.losses,
				streak: member.streak,
				arbitration: member.arbitration,
				outcome: member.outcome,
				oldrating: member.oldrating,
				newrating: member.newrating,
				reporttype: member.reporttype
			};
		});

		return {
			id: match.id,
			creator_profile_id: match.creator_profile_id,
			mapname: match.mapname,
			maxplayers: match.maxplayers,
			matchtype_id: match.matchtype_id,
			options: match.options,
			slotinfo: match.slotinfo,
			description: match.description,
			startgametime: match.startgametime,
			completiontime: match.completiontime,
			observertotal: match.observertotal,
			players,
			outcome: players.find((p) => p.profile_id === profileId)?.outcome ?? 0
		};
	});
}
