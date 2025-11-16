import { LEADERBOARD_IDS, MATCH_TYPES, getRacePrefix } from './helpers.js';

Handlebars.registerHelper('raceImg', function (race) {
    if (race === 0) {
        return './images/us.png';
    }

    if (race === 1) {
        return './images/wm.png';
    }

    if (race === 2) {
        return './images/cw.png';
    }

    if (race === 3) {
        return './images/pe.png';
    }

    return './images/us.png';
})

Handlebars.registerHelper('hasRanking', 
    /**
     * Check if player has a valid ranking
     * 
     * @param {number} ranking - The player's ranking
     * @returns {boolean} - True if ranking is greater than -1
     */
    (ranking) => {
        return ranking !== -1;
    }
);

Handlebars.registerHelper('rank', 
    /**
     * Get rank image
     * 
     * @param {keyof MATCH_TYPES} type - The type of match (e.g., '1v1', '2v2').
     * @param {import('./helpers.js').Player} player - The player object containing profile and ranking.
     * @returns {string} - Returns a rank image URL
     */
    (type, player) => {
        const prefix = getRacePrefix(player.race)
		const leaderBoardId = LEADERBOARD_IDS[`${MATCH_TYPES[type]}_${prefix}`];
        const statGroup = player.profile?.leaderboardStats?.find(
			(stat) => stat.leaderboard_id === leaderBoardId
		);

        if (!statGroup || statGroup.ranklevel < 1) {
            return './images/ranks/no_rank_yet.png';
        }

        return `./images/ranks/${prefix}_${statGroup.ranklevel.toString().padStart(2, '0')}.png`
    }
)

Handlebars.registerHelper('uppercase', 
    /**
     * Helper to format a string to uppercase
     * 
     * @param {string} string - The string to format.
     * @returns {string} - The formatted string.
     */
    (string) => string.toUpperCase()
)

Handlebars.registerHelper('length', (array) => 
    /**
     * Helper to get the length of an array
     * 
     * @param {array} any[]
     * @returns {number} - length of the array
     */
    array?.length || 0
);

export default {}