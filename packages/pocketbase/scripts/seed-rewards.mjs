// Seeds a local PocketBase with a realistic set of rewards (tiered faction wins, streaks,
// ratings, community and replay rewards), each with a matching service ribbon from
// `shared-assets/ribbons`. Local only: refuses any URL that is not localhost.
// Skips rewards whose title or conditions already exist, so it is safe to run again.
// Run: pnpm --filter @company-of-heroes/pocketbase seed:rewards
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const DIR = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(DIR, '..', '.env'), quiet: true });

const URL_BASE = (process.env.PB_PUBLIC_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;
const RIBBONS = JSON.parse(
	fs.readFileSync(path.join(DIR, '..', '..', 'shared-assets', 'ribbons', 'ribbons.json'), 'utf8')
);

const US = 0;
const WEHRMACHT = 1;
const BRITISH = 2;
const PANZER_ELITE = 3;
const GLOBAL = null;
const FACTION_NAMES = {
	[US]: 'the US Forces',
	[WEHRMACHT]: 'the Wehrmacht',
	[BRITISH]: 'the British Commonwealth',
	[PANZER_ELITE]: 'the Panzer Elite'
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Five-level reward: one ranked ribbon series, a level per threshold. */
function tier({ raceId, name, metric, filter, thresholds, describe }) {
	return thresholds.map((threshold, index) => ({
		title: `${name} ${ROMAN[index]}`,
		description: describe(threshold),
		conditions: [{ metric, threshold, ...(filter ? { filter } : {}) }],
		ribbon: { series: name, raceId, level: index + 1 }
	}));
}

function one(raceId, title, description, conditions, extra = {}) {
	return { title, description, conditions, ribbon: { raceId }, ...extra };
}

const REWARDS = [
	...tier({
		raceId: GLOBAL,
		name: 'Boots on the Ground',
		metric: 'matches_played',
		thresholds: [10, 50, 100, 500, 1000],
		describe: (n) => `Play ${n} matches.`
	}),
	...tier({
		raceId: US,
		name: 'Liberator',
		metric: 'wins',
		filter: { raceId: US },
		thresholds: [10, 50, 100, 250, 500],
		describe: (n) => `Win ${n} matches as ${FACTION_NAMES[US]}.`
	}),
	...tier({
		raceId: WEHRMACHT,
		name: 'Iron Will',
		metric: 'wins',
		filter: { raceId: WEHRMACHT },
		thresholds: [10, 50, 100, 250, 500],
		describe: (n) => `Win ${n} matches as ${FACTION_NAMES[WEHRMACHT]}.`
	}),
	...tier({
		raceId: BRITISH,
		name: 'Desert Rat',
		metric: 'wins',
		filter: { raceId: BRITISH },
		thresholds: [10, 50, 100, 250, 500],
		describe: (n) => `Win ${n} matches as ${FACTION_NAMES[BRITISH]}.`
	}),
	...tier({
		raceId: PANZER_ELITE,
		name: 'Panzer Ace',
		metric: 'wins',
		filter: { raceId: PANZER_ELITE },
		thresholds: [10, 50, 100, 250, 500],
		describe: (n) => `Win ${n} matches as ${FACTION_NAMES[PANZER_ELITE]}.`
	}),
	...tier({
		raceId: GLOBAL,
		name: 'Unstoppable',
		metric: 'win_streak',
		thresholds: [3, 5, 7, 10, 15],
		describe: (n) => `Win ${n} matches in a row.`
	}),
	...tier({
		raceId: GLOBAL,
		name: 'Climber',
		metric: 'elo_reached',
		filter: { matchtypeId: 1 },
		thresholds: [1300, 1500, 1700, 1950, 2200],
		describe: (n) => `Reach a 1v1 rating of ${n}.`
	}),
	...tier({
		raceId: GLOBAL,
		name: 'Time in the Trenches',
		metric: 'hours_played',
		thresholds: [10, 50, 100, 250, 500],
		describe: (n) => `Play Company of Heroes for ${n} hours.`
	}),

	...[US, WEHRMACHT, BRITISH, PANZER_ELITE].flatMap((raceId) =>
		tier({
			raceId,
			name: `${['US', 'Wehrmacht', 'Commonwealth', 'Panzer Elite'][raceId]} Command`,
			metric: 'rank_reached',
			filter: { raceId },
			thresholds: [4, 8, 12, 16, 20],
			describe: (n) =>
				n === 20
					? `Reach the highest rank (20) as ${FACTION_NAMES[raceId]} in automatch.`
					: `Reach rank ${n} as ${FACTION_NAMES[raceId]} in automatch.`
		})
	),
	one(
		GLOBAL,
		'Supreme Commander',
		'Reach the highest rank (20) with every faction in automatch.',
		[US, WEHRMACHT, BRITISH, PANZER_ELITE].map((raceId) => ({
			metric: 'rank_reached',
			threshold: 20,
			filter: { raceId }
		}))
	),

	one(GLOBAL, 'Duelist', 'Win 50 ranked 1v1 matches.', [
		{ metric: 'wins', threshold: 50, filter: { matchtypeId: 1, ranked: true } }
	]),
	one(GLOBAL, 'Brothers in Arms', 'Win 50 2v2 matches.', [
		{ metric: 'wins', threshold: 50, filter: { matchtypeId: 2 } }
	]),
	one(GLOBAL, 'Band of Brothers', 'Win 50 4v4 matches.', [
		{ metric: 'wins', threshold: 50, filter: { matchtypeId: 4 } }
	]),
	one(GLOBAL, 'Combined Arms', 'Win 25 matches with every faction.', [
		{ metric: 'wins', threshold: 25, filter: { raceId: US } },
		{ metric: 'wins', threshold: 25, filter: { raceId: WEHRMACHT } },
		{ metric: 'wins', threshold: 25, filter: { raceId: BRITISH } },
		{ metric: 'wins', threshold: 25, filter: { raceId: PANZER_ELITE } }
	]),
	one(GLOBAL, 'Giant Slayer', 'Win a 1v1 against a higher-rated opponent.', [
		{ metric: 'upset_wins', threshold: 1 }
	]),
	one(GLOBAL, 'David and Goliath', 'Win 25 1v1 matches against higher-rated opponents.', [
		{ metric: 'upset_wins', threshold: 25 }
	]),
	one(GLOBAL, 'Among the Elite', 'Win 10 matches in a Pro lobby.', [
		{ metric: 'wins', threshold: 10, filter: { pro: true } }
	]),
	one(GLOBAL, 'Heavyweight', 'Win 25 matches in lobbies averaging 1600 ELO or more.', [
		{ metric: 'wins', threshold: 25, filter: { minAvgElo: 1600 } }
	]),
	one(WEHRMACHT, 'Blitzkrieg', 'Win 10 matches in 10 minutes or less.', [
		{ metric: 'wins', threshold: 10, filter: { maxMinutes: 10 } }
	]),
	one(BRITISH, 'War of Attrition', 'Win 10 matches that last an hour or longer.', [
		{ metric: 'wins', threshold: 10, filter: { minMinutes: 60 } }
	]),
	one(US, 'Rails and Metal', 'Win 25 matches on Rails and Metal.', [
		{ metric: 'wins', threshold: 25, filter: { map: '4p_rails and metal' } }
	]),
	one(PANZER_ELITE, 'Langres Garrison', 'Win 25 matches on Langres.', [
		{ metric: 'wins', threshold: 25, filter: { map: '2p_langres' } }
	]),
	one(PANZER_ELITE, 'Tank Commander', 'Win 100 2v2 matches as the Panzer Elite.', [
		{ metric: 'wins', threshold: 100, filter: { raceId: PANZER_ELITE, matchtypeId: 2 } }
	]),

	one(GLOBAL, 'War Correspondent', 'Record 100 matches with the companion app.', [
		{ metric: 'matches_recorded', threshold: 100 }
	]),
	one(GLOBAL, 'Clean Record', 'Play 50 matches with fair play checks.', [
		{ metric: 'fair_play_matches', threshold: 50 }
	]),
	one(GLOBAL, 'Voice of the Front', 'Place 50 comments.', [
		{ metric: 'comments_created', threshold: 50 }
	]),
	one(GLOBAL, 'Debater', 'Reply to 25 comments.', [{ metric: 'replies_created', threshold: 25 }]),
	one(GLOBAL, 'Supporter', 'Give 50 upvotes.', [{ metric: 'votes_cast', threshold: 50 }]),
	one(GLOBAL, 'Well Spoken', 'Receive 25 upvotes on your comments.', [
		{ metric: 'comment_upvotes_received', threshold: 25 }
	]),
	one(GLOBAL, 'Respected', 'Receive 10 upvotes on your player profile.', [
		{ metric: 'player_upvotes_received', threshold: 10 }
	]),
	one(GLOBAL, 'Trusted', 'Reach 100 reputation.', [{ metric: 'reputation', threshold: 100 }]),
	one(GLOBAL, 'Cameraman', 'Upload your first replay.', [
		{ metric: 'replays_uploaded', threshold: 1 }
	]),
	one(GLOBAL, 'Archivist', 'Upload 25 replays.', [{ metric: 'replays_uploaded', threshold: 25 }]),
	one(GLOBAL, 'Highlight Reel', 'Receive 25 upvotes on your replays.', [
		{ metric: 'replay_likes_received', threshold: 25 }
	]),
	one(GLOBAL, 'Must Watch', 'Have your replays downloaded 100 times.', [
		{ metric: 'replay_downloads_received', threshold: 100 }
	]),
	one(GLOBAL, 'Student of the Game', 'Download 25 match replays.', [
		{ metric: 'replays_downloaded', threshold: 25 }
	]),
	one(US, 'Dressed for Parade', 'Complete your profile: avatar, bio, background and a link.', [
		{ metric: 'profile_complete', threshold: 1 }
	]),
	one(BRITISH, 'Old Guard', 'Have an account for a year.', [
		{ metric: 'account_age_days', threshold: 365 }
	]),
	one(GLOBAL, 'On Air', 'Stream Company of Heroes for 10 hours.', [
		{ metric: 'hours_streamed', threshold: 10 }
	]),
	one(GLOBAL, 'Broadcaster', 'Stream Company of Heroes for 100 hours.', [
		{ metric: 'hours_streamed', threshold: 100 }
	]),
	one(GLOBAL, 'Showman', 'Publish a stream overlay.', [
		{ metric: 'overlay_published', threshold: 1 }
	]),

	one(
		GLOBAL,
		'Untouchable',
		'Win 20 matches in a row.',
		[{ metric: 'win_streak', threshold: 20 }],
		{ secret: true }
	),
	one(
		WEHRMACHT,
		'Last Stand',
		'Win 50 1v1 matches against higher-rated opponents.',
		[{ metric: 'upset_wins', threshold: 50 }],
		{ secret: true }
	)
];

/** Same conditions regardless of order or key order. */
function conditionsKey(conditions) {
	return conditions
		.map(({ metric, threshold, filter }) =>
			JSON.stringify([
				metric,
				threshold,
				Object.entries(filter ?? {}).sort(([a], [b]) => a.localeCompare(b))
			])
		)
		.sort()
		.join('|');
}

function parseConditions(raw) {
	if (typeof raw !== 'string') {
		return Array.isArray(raw) ? raw : [];
	}

	try {
		return JSON.parse(raw);
	} catch {
		return [];
	}
}

/** Hands out ribbons nobody uses yet: a whole series for a tier, single ribbons otherwise. */
function ribbonPicker(used) {
	const taken = new Set(used);
	const seriesFor = new Map();
	const key = (entry) => entry.file.replace(/\.svg$/, '');
	return (want) => {
		if (want.series) {
			let series = seriesFor.get(want.series);
			if (!series) {
				const candidates = [
					...new Set(
						RIBBONS.filter((entry) => entry.series && entry.raceId === want.raceId).map(
							(entry) => entry.series
						)
					)
				];
				series = candidates.find((name) =>
					RIBBONS.filter((entry) => entry.series === name).every((entry) => !taken.has(key(entry)))
				);
				if (!series) {
					return '';
				}

				seriesFor.set(want.series, series);
			}

			const entry = RIBBONS.find((item) => item.series === series && item.level === want.level);
			taken.add(key(entry));
			return key(entry);
		}

		const entry = RIBBONS.find(
			(item) => !item.series && item.raceId === want.raceId && !taken.has(key(item))
		);
		if (!entry) {
			return '';
		}

		taken.add(key(entry));
		return key(entry);
	};
}

async function request(pathname, options = {}, token) {
	const response = await fetch(`${URL_BASE}${pathname}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: token } : {}),
			...options.headers
		}
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(
			`${options.method ?? 'GET'} ${pathname}: ${response.status} ${JSON.stringify(body)}`
		);
	}

	return body;
}

async function main() {
	const { hostname } = new URL(URL_BASE);
	if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
		throw new Error(`Refusing to seed ${URL_BASE}: local PocketBase only.`);
	}

	if (!EMAIL || !PASSWORD) {
		throw new Error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in packages/pocketbase/.env.');
	}

	const { token } = await request('/api/collections/_superusers/auth-with-password', {
		method: 'POST',
		body: JSON.stringify({ identity: EMAIL, password: PASSWORD })
	});
	const existing = await request(
		'/api/collections/rewards/records?perPage=500&fields=title,conditions,ribbon,sort',
		{},
		token
	);
	const titles = new Set(existing.items.map((item) => item.title.trim().toLowerCase()));
	const conditionSets = new Set(
		existing.items.map((item) => conditionsKey(parseConditions(item.conditions)))
	);
	const pickRibbon = ribbonPicker(existing.items.map((item) => item.ribbon).filter(Boolean));
	let sort = existing.items.reduce((max, item) => Math.max(max, item.sort ?? 0), -1) + 1;
	let created = 0;
	let skipped = 0;
	for (const reward of REWARDS) {
		const conditions = conditionsKey(reward.conditions);
		if (titles.has(reward.title.toLowerCase()) || conditionSets.has(conditions)) {
			skipped++;
			continue;
		}

		await request(
			'/api/collections/rewards/records',
			{
				method: 'POST',
				body: JSON.stringify({
					title: reward.title,
					description: reward.description,
					conditions: reward.conditions,
					ribbon: pickRibbon(reward.ribbon),
					enabled: true,
					secret: Boolean(reward.secret),
					sort: sort++
				})
			},
			token
		);
		conditionSets.add(conditions);
		created++;
	}

	console.log(`Created ${created} rewards, skipped ${skipped} that already exist.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
