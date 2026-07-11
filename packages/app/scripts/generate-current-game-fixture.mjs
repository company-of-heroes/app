import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/lib/dev');
const LOBBY_ID = process.argv[2] ?? '6c31ql2zlhwen5t';

const MATCH_TYPES = {
	0: 'Basic Match',
	1: '1 VS. 1',
	2: '2 VS. 2',
	3: '3 VS. 3',
	4: '4 VS. 4',
	14: 'Skirmish'
};

function getMatchType(isRanked, playerCount, isSkirmish = false) {
	if (isSkirmish) return 14;
	if (!isRanked) return 0;
	if (playerCount === 2) return 1;
	if (playerCount === 4) return 2;
	if (playerCount === 6) return 3;
	if (playerCount === 8) return 4;
	return 0;
}

function formatMapName(map) {
	const match = map.match(/^(\d+)p_(.+)$/);
	if (!match) {
		return map.trim().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	const [, playerCount, mapNameWithoutPrefix] = match;
	const formattedName = mapNameWithoutPrefix
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

	return `${formattedName} (${playerCount})`;
}

const res = await fetch(`https://api.coh1stats.com/api/collections/lobbies/records/${LOBBY_ID}`);
const lobby = await res.json();

if (!res.ok) {
	console.error('Failed to fetch lobby:', lobby);
	process.exit(1);
}

const players = lobby.players.map(({ matchHistory, ...player }) => player);
const isRanked = lobby.isRanked ?? false;
const isSkirmish = players.some((player) => player.playerId === -1);
const matchType = getMatchType(isRanked, players.length, isSkirmish);
const startedAt = lobby.createdAt?.split(' ')[1]?.replace('Z', '') ?? '00:00:00.00';
const me = players.find((player) => player.playerId === 2011215);

const match = {
	sessionId: lobby.sessionId,
	startedAt,
	map: lobby.map,
	players,
	teams: [],
	didNotify: false,
	started: true,
	isRanked,
	outcomeFormatted: 'Unknown',
	matchType,
	isSkirmish,
	type: MATCH_TYPES[matchType] ?? 'Custom Game',
	mapName: formatMapName(lobby.map),
	me
};

fs.writeFileSync(path.join(outDir, 'current-game-players.json'), JSON.stringify(players, null, '\t'));

const { players: _players, me: _me, teams: _teams, ...matchMeta } = match;

const testTs = `// Generated from PocketBase lobby ${LOBBY_ID}
import type { LobbyPlayer } from '@fknoobs/app';
import type { Match } from '$core/game/lobby';
import players from './current-game-players.json';

const me = (players as LobbyPlayer[]).find((player) => player.playerId === 2011215);

export const CURRENT_GAME_TEST = {
${Object.entries(matchMeta)
	.map(([key, value]) => `\t${key}: ${JSON.stringify(value)},`)
	.join('\n')}
\tteams: [],
\tplayers: players as LobbyPlayer[],
\tme
} as Match;
`;

fs.writeFileSync(path.join(outDir, 'current-game-test.ts'), testTs);

console.log(`Wrote fixture from lobby ${LOBBY_ID}`);
console.log(`map: ${lobby.map}, players: ${players.length}, ranked: ${isRanked}, matchType: ${matchType}`);
console.log(`me: ${me?.profile?.alias ?? 'not found'}`);
