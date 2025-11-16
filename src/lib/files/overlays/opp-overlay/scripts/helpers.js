export const LEADERBOARD_IDS = {
	'1v1_us': 4,
	'1v1_heer': 5,
	'1v1_brit': 6,
	'1v1_panzer': 7,
	'2v2_us': 8,
	'2v2_heer': 9,
	'2v2_brit': 10,
	'2v2_panzer': 11,
	'3v3_us': 12,
	'3v3_heer': 13,
	'3v3_brit': 14,
	'3v3_panzer': 15,
	'4v4_us': 16,
	'4v4_heer': 17,
	'4v4_brit': 18,
	'4v4_panzer': 19
}

export const MATCH_TYPES = {
	0: 'Custom Game',
	1: '1v1',
	2: '2v2',
	3: '3v3',
	4: '4v4',
	5: '2v2 AT',
	6: '3v3 AT',
	7: '4v4 AT',
	8: 'Assault 2v2',
	9: 'Assault 2v2 AT',
	10: 'Assault 3v3 AT',
	11: 'Panzerkrieg 2v2',
	12: 'Panzerkrieg 2v2 AT',
	13: 'Panzerkrieg 3v3 AT',
	14: 'Comp Stomp',
	15: 'Assault',
	16: 'Panzerkrieg',
	17: 'Stonewall'
}

/**
 * Get race prefix
 * 
 * @param {0 | 1 | 2 | 3} race 
 */
export const getRacePrefix = (race) => {
    switch(race) {
        case 0:
            return 'us';
        case 1:
            return 'heer';
        case 2:
            return 'brit';
        case 3:
            return 'panzer';
        default:
            return 'us';
    }
}

/**
 * @typedef {Object} LeaderboardStat
 * @property {number} disputes
 * @property {number} drops
 * @property {number} highestrank
 * @property {number} highestranklevel
 * @property {number} [lastmatchdate]
 * @property {number} leaderboard_id
 * @property {number} losses
 * @property {number} rank
 * @property {number} ranklevel
 * @property {number} ranktotal
 * @property {number} regionrank
 * @property {number} regionranktotal
 * @property {number} statgroup_id
 * @property {number} streak
 * @property {number} wins
 */

/**
 * @typedef {Object} PlayerProfile
 * @property {string} alias
 * @property {string} country
 * @property {LeaderboardStat[]} leaderboardStats
 * @property {number} leaderboardregion_id
 * @property {number} level
 * @property {string} name
 * @property {number} personal_statgroup_id
 * @property {number} profile_id
 * @property {number} xp
 */

/**
 * @typedef {Object} Player
 * @property {number} index
 * @property {number} playerId
 * @property {PlayerProfile} profile
 * @property {number} race - Race ID (0: US, 1: Wehrmacht, 2: Commonwealth, 3: Panzer Elite)
 * @property {number} ranking
 * @property {string} steamId
 * @property {number} team
 * @property {number} type
 */