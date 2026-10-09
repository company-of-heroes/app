import { err, errAsync, okAsync, ResultAsync } from 'neverthrow';
import type {
	TournamentDetail,
	TournamentFormat,
	TournamentInput,
	TournamentMatch,
	TournamentParticipant,
	TournamentReportRecord,
	TournamentScheduleProposal
} from '@company-of-heroes/api/tournaments';
import type { AuthUserPublic } from '$lib/auth/user';
import { SITE_URL } from '$lib/site/urls';
import { uncache } from '../cache';
import { badRequest, internal, notFound, type AppError } from '../errors';
import { all, fromPb, inParallel, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

/*
 * Reserved ranges, far from real data: bot accounts `dev-sim-{n}@fknoobs.com`, Steam ids below
 * the real range (76561190000900001…), players rows from profile id 990000001, lobby sessions
 * from 990000001 and tournaments `sim-{k}` named "Simulation #{k}".
 */
/** Dev "view as": the staff session to return to while the browser acts as a bot. */
export const SIM_RETURN_COOKIE = 'pb_auth_dev_return';

const BOT_EMAIL = (n: number) => `dev-sim-${n}@fknoobs.com`;
export const BOT_EMAIL_PATTERN = /^dev-sim-\d+@fknoobs\.com$/;
const BOT_STEAM = (n: number) => `765611900009${String(n).padStart(5, '0')}`;
const BOT_STEAM_PREFIX = '765611900009';
const PROFILE_BASE = 990_000_000;
const SESSION_BASE = 990_000_000;
const SESSION_END = 991_000_000;
const SIM_SLUG = /^sim-(\d+)$/;
const SIM_URL = /\/tournaments\/sim-\d+(\?|$)/;
const BOT_VERSION = 'dev-sim';
/** Reports a player may send per match before the rate limit kicks in. */
const REPORT_LIMIT = 3;
/** Rounds `finish` plays at most (a 16-player double elimination needs about 10). */
const MAX_ROUNDS = 40;
const SIM_MAPS = [
	'2p_langres',
	'2p_angoville farms',
	'2p_beaux lowlands',
	'2p_lyon',
	'2p_carpiquet'
];
const CALL_SIGNS = [
	'Able Fox',
	'Baker Wolf',
	'Charlie Hawk',
	'Dog Easy',
	'Easy Eight',
	'Fox Hole',
	'George Item',
	'How Battery',
	'Item Gun',
	'Jig Saw',
	'King Tiger',
	'Love Charlie',
	'Mike Rifle',
	'Nan Bocage',
	'Oboe Mortar',
	'Peter Pak',
	'Queen Bee',
	'Roger Wilco'
];
const RULES = [
	'- Best of the format, maps from the pool.',
	'- Start every game with "Start tournament game" in the desktop app.',
	'- Report problems with the match from the tournament page.'
].join('\n');

export const SIM_ACTIONS = [
	'create',
	'register',
	'rulesChange',
	'close',
	'start',
	'feature',
	'schedule',
	'report',
	'overdue',
	'playMatch',
	'disqualify',
	'playRound',
	'finish',
	'runAll',
	'reset'
] as const;
export type SimActionName = (typeof SIM_ACTIONS)[number];

export type SimCreateOptions = {
	players: 4 | 8 | 16;
	format: TournamentFormat;
	bestOf: 1 | 3;
	includeMe: boolean;
};

export type SimAction =
	| { action: 'create' | 'runAll'; options: SimCreateOptions }
	| { action: 'playMatch'; slug: string; matchId?: string }
	| {
			action: Exclude<SimActionName, 'create' | 'runAll' | 'playMatch' | 'reset'>;
			slug: string;
	  }
	| { action: 'reset' };

export type SimCheck = { label: string; ok: boolean; detail?: string };

export type SimStep = {
	step: SimActionName;
	ok: boolean;
	log: string[];
	checks: SimCheck[];
	slug: string | null;
};

export type SimTournamentRow = {
	id: string;
	slug: string;
	name: string;
	status: string;
	created: string;
};

export type SimNotifications = { count: number; latest: string[] };

export type SimPlayer = {
	participantId: string;
	userId: string;
	alias: string;
	bot: boolean;
	me: boolean;
	notifications: SimNotifications;
};

export type SimClaim = {
	id: string;
	match: string;
	participant: string;
	status: string;
	sessionId: number;
	lobby: string;
};

export type SimOverview = {
	tournaments: SimTournamentRow[];
	current: {
		detail: TournamentDetail;
		players: SimPlayer[];
		staffNotifications: SimNotifications;
		reports: TournamentReportRecord[];
		schedules: TournamentScheduleProposal[];
		claims: SimClaim[];
		hiddenSessions: number[];
	} | null;
};

type Bot = { n: number; user: AuthUserPublic; steamId: string; profileId: number; alias: string };

type UserRecord = {
	id: string;
	email: string;
	name?: string;
	steamIds?: string[];
	role?: AuthUserPublic['role'];
	verified?: boolean;
};

type ClaimRow = SimClaim & { tournament: string };

/** A match player with the account the simulator acts as. */
type Seat = Omit<TournamentParticipant, 'user'> & { user: AuthUserPublic };

type GamePlayer = Pick<TournamentParticipant, 'alias' | 'profileId' | 'steamId' | 'country'>;

type NotificationRow = { id: string; title: string; created: string };

/** Stored in the description: how many bots play, and the staff member who plays along. */
type Settings = { bots: number; me: string | null; meSteamId: string | null };

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const playable = (match: TournamentMatch) =>
	match.status === 'ready' && !match.bye && !!match.playerA && !!match.playerB;

const toAuthUser = (record: UserRecord): AuthUserPublic => ({
	id: record.id,
	email: record.email,
	name: record.name,
	steamIds: record.steamIds ?? [],
	role: record.role,
	verified: Boolean(record.verified)
});

/** A task that never throws: a sync throw (an unfinished stub) or a rejection becomes an error. */
function guard<T>(fn: () => Task<T>): Task<T> {
	let task: Task<T>;
	try {
		task = fn();
	} catch (cause) {
		return errAsync(internal(message(cause)));
	}

	return new ResultAsync(
		Promise.resolve(task).catch((cause: unknown) => err<T, AppError>(internal(message(cause))))
	);
}

function settingsLine(settings: Settings): string {
	return `Simulation settings: bots=${settings.bots} me=${settings.me ?? '-'} steam=${settings.meSteamId ?? '-'}`;
}

function parseSettings(description: string): Settings {
	const found = /Simulation settings: bots=(\d+) me=(\S+) steam=(\S+)/.exec(description);
	if (!found) {
		return { bots: 0, me: null, meSteamId: null };
	}

	return {
		bots: Number(found[1]),
		me: found[2] === '-' ? null : found[2],
		meSteamId: found[3] === '-' ? null : found[3]
	};
}

/** Log and checks of one step. */
class Run {
	readonly log: string[] = [];
	readonly checks: SimCheck[] = [];

	constructor(
		readonly step: SimActionName,
		public slug: string | null
	) {}

	note(line: string) {
		this.log.push(line);
	}

	check(label: string, ok: boolean, detail?: string): boolean {
		this.checks.push(detail ? { label, ok, detail } : { label, ok });
		return ok;
	}

	done(): SimStep {
		return {
			step: this.step,
			ok: this.checks.every((check) => check.ok),
			log: this.log,
			checks: this.checks,
			slug: this.slug
		};
	}
}

/**
 * Dev only: a fake tournament with bot players, stepped through the real services (sign-ups,
 * rules, closing, bracket, scheduling, reports, deadlines, games, disqualification, the finish),
 * each step followed by checks. See `/tournaments/simulate`.
 */
export class DevTournamentSimService extends Service {
	/** Next free lobby session id; loaded once per request. */
	private sessionCursor: number | null = null;

	// ── Overview ────────────────────────────────────────────────────────────

	list(): Task<SimTournamentRow[]> {
		return fromPb(
			this.pb.collection('tournaments').getFullList<SimTournamentRow>({
				filter: 'slug ~ "sim-%"',
				sort: '-created',
				fields: 'id,slug,name,status,created'
			}),
			'Could not load the simulations'
		).map((rows) => rows.filter((row) => SIM_SLUG.test(row.slug)));
	}

	overview(staff: AuthUserPublic, slug: string | null): Task<SimOverview> {
		return this.list().andThen((tournaments) =>
			slug
				? this.current(staff, slug).map((current) => ({ tournaments, current }))
				: okAsync({ tournaments, current: null })
		);
	}

	private current(staff: AuthUserPublic, slug: string): Task<SimOverview['current']> {
		return this.detail(slug).andThen((detail) => {
			const tournament = detail.tournament;
			const matchIds = detail.matches.map((match) => match.id);
			return ResultAsync.combine([
				this.botIds(),
				inParallel(detail.participants, 4, (p) =>
					this.inbox(p.user, tournament).map((rows) => [p.user, rows] as const)
				),
				this.inbox(staff.id, tournament),
				guard(() => this.services.tournamentReports.list(tournament.id)).orElse(() =>
					okAsync([] as TournamentReportRecord[])
				),
				guard(() => this.services.tournamentSchedule.forMatches(matchIds))
					.map((byMatch) => [...byMatch.values()])
					.orElse(() => okAsync([] as TournamentScheduleProposal[])),
				this.claims(tournament.id),
				fromPb(
					this.pb.collection('hidden_matches').getFullList<{ sessionId: number }>({
						filter: this.pb.filter('tournament = {:id}', { id: tournament.id }),
						fields: 'sessionId'
					}),
					'Could not load hidden matches'
				)
			]).map(([bots, inboxes, staffInbox, reports, schedules, claims, hidden]) => {
				const byUser = new Map(inboxes);
				const settings = parseSettings(tournament.description);
				return {
					detail,
					players: detail.participants.map((p) => ({
						participantId: p.id,
						userId: p.user,
						alias: p.alias,
						bot: bots.has(p.user),
						me: p.user === settings.me,
						notifications: summary(byUser.get(p.user) ?? [])
					})),
					staffNotifications: summary(staffInbox),
					reports,
					schedules,
					claims,
					hiddenSessions: hidden.map((row) => Number(row.sessionId))
				};
			});
		});
	}

	/** Whether the account is a simulator bot ("view as" only switches to those). */
	isBot(userId: string): Task<boolean> {
		return pbMaybe(
			this.pb.collection('users').getOne<{ email: string }>(userId, { fields: 'email' }),
			'Could not load the account'
		).map((user) => !!user && BOT_EMAIL_PATTERN.test(user.email));
	}

	// ── Actions ─────────────────────────────────────────────────────────────

	run(staff: AuthUserPublic, input: SimAction): Task<SimStep[]> {
		switch (input.action) {
			case 'runAll':
				return this.runAll(staff, input.options);
			case 'create':
				return this.step('create', null, (run) => this.create(run, staff, input.options)).map(
					(step) => [step]
				);
			case 'reset':
				return this.step('reset', null, (run) => this.reset(run)).map((step) => [step]);
			case 'playMatch':
				return this.step('playMatch', input.slug, (run) =>
					this.playMatch(run, input.slug, input.matchId)
				).map((step) => [step]);
			default:
				return this.byName(staff, input.action, input.slug).map((step) => [step]);
		}
	}

	private byName(
		staff: AuthUserPublic,
		name: Exclude<SimActionName, 'create' | 'runAll' | 'reset'>,
		slug: string
	): Task<SimStep> {
		const bodies: Record<typeof name, (run: Run) => Task<void>> = {
			register: (run) => this.register(run, slug),
			rulesChange: (run) => this.rulesChange(run, slug),
			close: (run) => this.close(run, staff, slug),
			start: (run) => this.start(run, slug),
			feature: (run) => this.feature(run, slug),
			schedule: (run) => this.schedule(run, slug),
			report: (run) => this.report(run, staff, slug),
			overdue: (run) => this.overdue(run, staff, slug),
			playMatch: (run) => this.playMatch(run, slug),
			disqualify: (run) => this.disqualify(run, slug),
			playRound: (run) => this.playRound(run, slug),
			finish: (run) => this.finish(run, slug)
		};
		return this.step(name, slug, bodies[name]);
	}

	/** Runs a step; whatever fails ends up as a failing check, never as an error. */
	private step(
		name: SimActionName,
		slug: string | null,
		body: (run: Run) => Task<void>
	): Task<SimStep> {
		const run = new Run(name, slug);
		return guard(() => body(run))
			.orElse((error) => {
				run.check('Step ran to the end', false, error.message);
				return okAsync(undefined);
			})
			.map(() => run.done());
	}

	private runAll(staff: AuthUserPublic, options: SimCreateOptions): Task<SimStep[]> {
		const flow = [
			'register',
			'rulesChange',
			'close',
			'start',
			'feature',
			'schedule',
			'report',
			'overdue',
			'playMatch',
			'disqualify',
			'finish'
		] as const;
		return this.step('create', null, (run) => this.create(run, staff, options)).andThen(
			(created) => {
				const slug = created.slug;
				if (!slug) {
					return okAsync([created]);
				}

				return sequence(flow, (name) => this.byName(staff, name, slug)).map((steps) => [
					created,
					...steps
				]);
			}
		);
	}

	// ── Steps ───────────────────────────────────────────────────────────────

	private create(run: Run, staff: AuthUserPublic, options: SimCreateOptions): Task<void> {
		const tournaments = this.services.tournaments;
		return (options.includeMe ? this.playableSteamId(run, staff) : okAsync(null))
			.andThen((meSteamId) => {
				const settings: Settings = {
					bots: meSteamId ? options.players - 1 : options.players,
					me: meSteamId ? staff.id : null,
					meSteamId
				};
				// One spare bot tries to sign up without accepting the rules.
				return this.ensureBots(settings.bots + 1).map((bots) => ({ settings, bots }));
			})
			.andThen(({ settings, bots }) => {
				run.note(`${bots.length} bot accounts ready (${bots.length - 1} players, 1 spare).`);
				return this.nextNumber().andThen((k) => {
					const now = Date.now();
					const input: TournamentInput = {
						name: `Simulation #${k}`,
						description: `Simulated tournament with bot players (local development).\n\n${settingsLine(settings)}`,
						rules: RULES,
						format: options.format,
						bestOf: options.bestOf,
						finalsBestOf: null,
						grandFinalReset: false,
						registrationClosesAt: new Date(now + 60 * 60 * 1000).toISOString(),
						startsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
						maxParticipants: options.players,
						mapPool: SIM_MAPS,
						streamUrl: 'https://twitch.tv/coh1stats'
					};
					return guard(() => tournaments.create(input, {}, staff.id)).andThen((created) =>
						fromPb(
							this.pb.collection('tournaments').update(created.id, { slug: `sim-${k}` }),
							'Could not rename the simulation'
						).map(() => ({ id: created.id, slug: `sim-${k}` }))
					);
				});
			})
			.andThen(({ id, slug }) => {
				run.slug = slug;
				run.note(
					`Created ${slug} (${options.players} players, ${options.format}, Bo${options.bestOf}).`
				);
				return guard(() => tournaments.update(id, { status: 'registration' })).andThen(() =>
					this.detail(slug)
				);
			})
			.map((detail) => {
				const t = detail.tournament;
				run.check('Registration is open', t.status === 'registration', t.status);
				run.check(
					'Stream link is set',
					t.streamUrl === 'https://twitch.tv/coh1stats',
					t.streamUrl ?? ''
				);
				run.check(
					'Registration closes and the tournament starts later',
					!!t.registrationClosesAt && !!t.startsAt
				);
			});
	}

	private register(run: Run, slug: string): Task<void> {
		const tournaments = this.services.tournaments;
		return this.load(slug).andThen(({ detail, settings }) =>
			this.ensureBots(settings.bots + 1).andThen((bots) => {
				const t = detail.tournament;
				const players = bots.slice(0, settings.bots);
				const spare = bots[settings.bots];
				// First, while there is room: a full tournament would also refuse the spare.
				return this.expectErr(
					run,
					`${spare.alias} cannot sign up without accepting the rules`,
					() => tournaments.register(t.id, spare.user, spare.steamId, false)
				)
					.andThen(() => this.dropSpare(run, slug, spare))
					.andThen(() =>
						sequence(players, (bot) =>
							this.expectOk(run, `${bot.alias} signs up`, () =>
								tournaments.register(t.id, bot.user, bot.steamId, true)
							)
						)
					)
					.andThen(() =>
						settings.me && settings.meSteamId
							? this.userOf(settings.me).andThen((me) =>
									this.expectOk(run, `${me.name || me.email} (you) signs up`, () =>
										tournaments.register(t.id, me, settings.meSteamId!, true)
									)
								)
							: okAsync(null)
					)
					.andThen(() => this.detail(slug))
					.andThen((after) => {
						const expected = settings.bots + (settings.me ? 1 : 0);
						const registered = after.participants.filter((p) => p.status === 'registered');
						run.check(
							'Everyone is signed up',
							registered.length === expected,
							`${registered.length} of ${expected}`
						);
						run.check(
							'The spare bot is not signed up',
							!after.participants.some((p) => p.user === spare.user.id)
						);
						const unaccepted = registered.filter((p) => !p.rulesAccepted).map((p) => p.alias);
						run.check(
							'Everyone accepted the rules',
							unaccepted.length === 0,
							unaccepted.join(', ')
						);
						return inParallel(registered, 4, (p) =>
							this.inbox(p.user, after.tournament).map((rows) =>
								rows.some((row) => row.title.startsWith('You are signed up for')) ? null : p.alias
							)
						).map((missing) => {
							const names = missing.filter(Boolean);
							run.check('Everyone got "You are signed up"', names.length === 0, names.join(', '));
						});
					});
			})
		);
	}

	private rulesChange(run: Run, slug: string): Task<void> {
		const tournaments = this.services.tournaments;
		return this.load(slug).andThen(({ detail }) => {
			const t = detail.tournament;
			const rules = `${t.rules}\n- Changed ${new Date().toISOString().slice(11, 19)} UTC: no artillery in the first five minutes.`;
			return this.expectOk(run, 'Staff change the rules', () => tournaments.update(t.id, { rules }))
				.andThen(() => this.detail(slug))
				.andThen((after) => {
					const post = after.posts.find((p) => p.kind === 'rules');
					run.check('An important "rules" update is posted', !!post?.important);
					run.check('rulesUpdatedAt is set', !!after.tournament.rulesUpdatedAt);
					const registered = after.participants.filter((p) => p.status === 'registered');
					const still = registered.filter((p) => p.rulesAccepted).map((p) => p.alias);
					run.check('Everyone has to accept the rules again', still.length === 0, still.join(', '));
					const first = registered.find((p) => p.user !== parseSettings(t.description).me);
					if (!first) {
						return okAsync(undefined);
					}

					return this.userOf(first.user)
						.andThen((user) =>
							this.expectOk(run, `${first.alias} accepts the new rules`, () =>
								tournaments.acceptRules(t.id, user)
							)
						)
						.andThen(() => this.detail(slug))
						.andThen((accepted) => {
							const again = accepted.participants.find((p) => p.id === first.id);
							run.check(`${first.alias} accepted the current rules`, !!again?.rulesAccepted);
							// The other bots accept too, so the games can go on; you accept yourself.
							return this.acceptAll(run, accepted, true);
						});
				});
		});
	}

	private close(run: Run, staff: AuthUserPublic, slug: string): Task<void> {
		return this.load(slug).andThen(({ detail }) => {
			const t = detail.tournament;
			const closedTitle = `Registration for ${t.name} closed`;
			const staffCount = () =>
				this.inbox(staff.id, t).map(
					(rows) => rows.filter((row) => row.title === closedTitle).length
				);
			return fromPb(
				this.pb.collection('tournaments').update(t.id, {
					registrationClosesAt: pbDate(new Date(Date.now() - 60_000)),
					autoClosedAt: ''
				}),
				'Could not move the closing time'
			)
				.andThen(() => {
					run.note('Moved registrationClosesAt to a minute ago.');
					return staffCount();
				})
				.andThen((before) =>
					this.deadlinesJob(run)
						.andThen(() =>
							ResultAsync.combine([
								this.detail(slug),
								fromPb(
									this.pb.collection('tournaments').getOne<{ autoClosedAt: string }>(t.id, {
										fields: 'autoClosedAt'
									}),
									'Could not load the tournament'
								),
								staffCount()
							])
						)
						.andThen(([after, record, count]) => {
							run.check(
								'Status is seeding',
								after.tournament.status === 'seeding',
								after.tournament.status
							);
							run.check('autoClosedAt is set', !!record.autoClosedAt, record.autoClosedAt);
							run.check(
								'A "seeded" update is posted',
								after.posts.some((p) => p.kind === 'seeded')
							);
							run.check(`You got "${closedTitle}"`, count === before + 1, `${count - before} new`);
							run.note('Running the deadlines job again.');
							return this.deadlinesJob(run)
								.andThen(() => staffCount())
								.map((again) => {
									run.check(
										'Running the job again sends nothing new',
										again === count,
										`${again - count} new`
									);
								});
						})
				);
		});
	}

	private start(run: Run, slug: string): Task<void> {
		return this.load(slug).andThen(({ detail }) =>
			this.expectOk(run, 'Staff start the tournament', () =>
				this.services.tournaments.start(detail.tournament.id)
			)
				.andThen(() => this.detail(slug))
				.andThen((after) => {
					const ready = after.matches.filter(playable);
					run.check(
						'Status is in_progress',
						after.tournament.status === 'in_progress',
						after.tournament.status
					);
					run.check(
						'The bracket has matches',
						after.matches.length > 0,
						`${after.matches.length} matches`
					);
					run.check(
						'A "started" update is posted',
						after.posts.some((p) => p.kind === 'started')
					);
					run.check('Matches are ready to play', ready.length > 0, `${ready.length} ready`);
					return this.deadlinesJob(run);
				})
		);
	}

	private feature(run: Run, slug: string): Task<void> {
		return this.load(slug).andThen(({ detail }) => {
			const match = detail.matches.find(playable);
			if (!match) {
				run.check('A ready match to feature', false);
				return okAsync(undefined);
			}

			return this.expectOk(run, `Staff feature ${this.label(detail, match)}`, () =>
				this.services.tournaments.feature(detail.tournament.id, match.id)
			)
				.andThen(() => this.detail(slug))
				.map((after) => {
					run.check('It is the featured match', after.tournament.featuredMatch === match.id);
				});
		});
	}

	private schedule(run: Run, slug: string): Task<void> {
		const schedule = this.services.tournamentSchedule;
		return this.load(slug).andThen(({ detail }) => {
			const t = detail.tournament;
			const match = detail.matches.find(playable);
			if (!match) {
				run.check('A ready match to schedule', false);
				return okAsync(undefined);
			}

			const now = Date.now();
			const times = [
				new Date(now + 20 * 60_000).toISOString(),
				new Date(now + 2 * 60 * 60_000).toISOString()
			];
			return this.seats(detail, match).andThen(([a, b]) => {
				const counts = () =>
					ResultAsync.combine([this.inbox(a.user.id, t), this.inbox(b.user.id, t)]).map(
						([rowsA, rowsB]) => [rowsA.length, rowsB.length] as const
					);
				run.note(`${a.alias} vs ${b.alias}: ${a.alias} proposes ${times.join(' and ')}.`);
				return counts().andThen(([beforeA, beforeB]) =>
					this.expectOk(run, `${a.alias} proposes two times`, () =>
						schedule.propose(a.user, t.id, match.id, times)
					).andThen((proposal) => {
						if (!proposal) {
							return okAsync(undefined);
						}

						const time = proposal.times[0] ?? times[0];
						return counts()
							.andThen(([afterA, afterB]) => {
								run.check(
									`${b.alias} hears about the proposal`,
									afterB > beforeB,
									`${afterB - beforeB} new`
								);
								run.check(
									`${a.alias} gets a confirmation of the proposal`,
									afterA > beforeA,
									`${afterA - beforeA} new`
								);
								return this.expectErr(run, `${a.alias} cannot accept their own proposal`, () =>
									schedule.accept(a.user, t.id, match.id, proposal.id, time)
								)
									.andThen(() =>
										this.expectOk(run, `${b.alias} accepts the earliest time`, () =>
											schedule.accept(b.user, t.id, match.id, proposal.id, time)
										)
									)
									.andThen(() => ResultAsync.combine([this.detail(slug), counts()]))
									.map(([after, [acceptedA, acceptedB]]) => {
										const scheduled = after.matches.find((m) => m.id === match.id)?.scheduledAt;
										run.check(
											'The match has the agreed time',
											!!scheduled && Math.abs(Date.parse(scheduled) - Date.parse(time)) < 60_000,
											scheduled ?? 'not set'
										);
										run.check(
											'Both players hear about the agreed time',
											acceptedA > afterA && acceptedB > afterB,
											`${a.alias} +${acceptedA - afterA}, ${b.alias} +${acceptedB - afterB}`
										);
										return [acceptedA, acceptedB] as const;
									});
							})
							.andThen(([beforeRemindA, beforeRemindB]) =>
								this.expectOk(run, 'Reminder job runs (1st)', () => schedule.remind())
									.andThen((sent) => {
										run.note(`remind() sent ${sent ?? 0}.`);
										return this.expectOk(run, 'Reminder job runs (2nd)', () => schedule.remind());
									})
									.andThen((sent) => {
										run.note(`remind() sent ${sent ?? 0} the second time.`);
										return counts();
									})
									.map(([remindedA, remindedB]) => {
										run.check(
											'Exactly one "starts soon" reminder each',
											remindedA - beforeRemindA === 1 && remindedB - beforeRemindB === 1,
											`${a.alias} +${remindedA - beforeRemindA}, ${b.alias} +${remindedB - beforeRemindB}`
										);
									})
							);
					})
				);
			});
		});
	}

	private report(run: Run, staff: AuthUserPublic, slug: string): Task<void> {
		const reports = this.services.tournamentReports;
		return this.load(slug).andThen(({ detail }) => {
			const t = detail.tournament;
			const match = detail.matches.find(playable);
			if (!match) {
				run.check('A ready match to report', false);
				return okAsync(undefined);
			}

			return this.seats(detail, match).andThen(([a]) => {
				const count = (userId: string) => this.inbox(userId, t).map((rows) => rows.length);
				return count(staff.id).andThen((staffBefore) =>
					this.expectOk(run, `${a.alias} reports a no-show`, () =>
						reports.create(a.user, t.id, match.id, {
							reason: 'no_show',
							message: 'Simulated: my opponent did not show up.'
						})
					).andThen((report) => {
						if (!report) {
							return okAsync(undefined);
						}

						return ResultAsync.combine([guard(() => reports.list(t.id)), count(staff.id)])
							.andThen(([listed, staffAfter]) => {
								const row = listed.find((r) => r.id === report.id);
								run.check(
									'The report is open in the staff list',
									row?.status === 'open',
									row?.status ?? 'missing'
								);
								run.check(
									'Staff are notified',
									staffAfter > staffBefore,
									`${staffAfter - staffBefore} new`
								);
								const more = (['disconnect', 'other', 'conduct'] as const).map((reason, i) => ({
									reason,
									allowed: i + 2 <= REPORT_LIMIT,
									number: i + 2
								}));
								return sequence(more, ({ reason, allowed, number }) => {
									const create = () =>
										reports.create(a.user, t.id, match.id, {
											reason,
											message: `Simulated report #${number}.`
										});
									return allowed
										? this.expectOk(run, `Report #${number} is accepted`, create).map(
												() => undefined
											)
										: this.expectErr(run, `Report #${number} is rejected (rate limit)`, create);
								});
							})
							.andThen(() => count(a.user.id))
							.andThen((reporterBefore) =>
								this.expectOk(run, 'Staff resolve the first report with a note', () =>
									reports.update(staff, t.id, report.id, {
										status: 'resolved',
										staffNote: 'Simulated: we checked the lobby and gave a new deadline.'
									})
								)
									.andThen(() =>
										ResultAsync.combine([
											count(a.user.id),
											guard(() => this.services.tournamentGames.mine(a.user))
										])
									)
									.map(([reporterAfter, mine]) => {
										run.check(
											`${a.alias} hears the outcome`,
											reporterAfter > reporterBefore,
											`${reporterAfter - reporterBefore} new`
										);
										const seen = mine.matches
											.find((item) => item.match.id === match.id)
											?.reports.find((r) => r.id === report.id);
										run.check(
											'"My tournament" shows the report resolved with the note',
											seen?.status === 'resolved' && !!seen.staffNote,
											seen ? `${seen.status}: ${seen.staffNote}` : 'missing'
										);
									})
							);
					})
				);
			});
		});
	}

	private overdue(run: Run, staff: AuthUserPublic, slug: string): Task<void> {
		return this.load(slug).andThen(({ detail }) => {
			const t = detail.tournament;
			const match = detail.matches.filter(playable).at(-1);
			if (!match) {
				run.check('A ready match to put past its deadline', false);
				return okAsync(undefined);
			}

			const title = `Tournament match overdue: ${t.name}`;
			const count = () =>
				this.inbox(staff.id, t).map((rows) => rows.filter((row) => row.title === title).length);
			return count().andThen((before) =>
				this.expectOk(run, `Staff give ${this.label(detail, match)} a deadline in the past`, () =>
					this.services.tournaments.setMatchDeadline(
						t.id,
						match.id,
						new Date(Date.now() - 60_000).toISOString()
					)
				)
					.andThen(() =>
						this.expectOk(run, 'Overdue job runs (1st)', () =>
							this.services.tournamentGames.notifyOverdue()
						)
					)
					.andThen(() =>
						this.expectOk(run, 'Overdue job runs (2nd)', () =>
							this.services.tournamentGames.notifyOverdue()
						)
					)
					.andThen(() => count())
					.map((after) => {
						run.check(
							'Staff hear about it exactly once',
							after - before === 1,
							`${after - before} notices`
						);
					})
			);
		});
	}

	private playMatch(run: Run, slug: string, matchId?: string): Task<void> {
		return this.detail(slug).andThen((detail) => {
			const featured = detail.matches.find((m) => m.id === detail.tournament.featuredMatch);
			const match = matchId
				? detail.matches.find((m) => m.id === matchId)
				: featured && playable(featured)
					? featured
					: detail.matches.find(playable);
			if (!match || !playable(match)) {
				run.check(
					'A ready match to play',
					false,
					matchId ? `${matchId} is not ready` : 'none ready'
				);
				return okAsync(undefined);
			}

			return this.playOut(run, slug, match.id);
		});
	}

	private disqualify(run: Run, slug: string): Task<void> {
		return this.load(slug).andThen(({ detail, settings }) => {
			const t = detail.tournament;
			const target = detail.matches
				.filter(playable)
				.filter((m) => m.id !== t.featuredMatch)
				.flatMap((m) => [m.playerA, m.playerB])
				.map((id) => detail.participants.find((p) => p.id === id))
				.find(
					(p): p is TournamentParticipant =>
						!!p && p.status === 'registered' && p.user !== settings.me
				);
			if (!target) {
				run.check('A bot in a ready match to disqualify', false);
				return okAsync(undefined);
			}

			const open = detail.matches.find(
				(m) => playable(m) && (m.playerA === target.id || m.playerB === target.id)
			)!;
			return this.expectOk(run, `Staff disqualify ${target.alias}`, () =>
				this.services.tournaments.disqualify(t.id, target.id)
			)
				.andThen(() => ResultAsync.combine([this.detail(slug), this.inbox(target.user, t)]))
				.map(([after, inbox]) => {
					const post = after.posts.find((p) => p.kind === 'disqualified');
					run.check(
						'A "disqualified" update is posted',
						!!post,
						post ? String(post.data.alias ?? '') : ''
					);
					run.check(
						`${target.alias} hears they are disqualified`,
						inbox.some((row) => row.title.startsWith('You were disqualified from'))
					);
					const forfeited = after.matches.find((m) => m.id === open.id);
					const opponent = open.playerA === target.id ? open.playerB : open.playerA;
					run.check(
						'Their open match is a forfeit win for the opponent',
						forfeited?.status === 'completed' && forfeited.winner === opponent,
						forfeited
							? `${forfeited.status}, winner ${this.alias(after, forfeited.winner)}`
							: 'missing'
					);
				});
		});
	}

	private playRound(run: Run, slug: string): Task<void> {
		return this.detail(slug).andThen((detail) => {
			const ready = detail.matches.filter(playable);
			run.note(`Playing ${ready.length} ready matches.`);
			if (ready.length === 0) {
				run.check('Ready matches to play', false);
				return okAsync(undefined);
			}

			return sequence(ready, (match) => this.playOut(run, slug, match.id)).map(() => undefined);
		});
	}

	private finish(run: Run, slug: string): Task<void> {
		const rounds = (left: number): Task<TournamentDetail> =>
			this.detail(slug).andThen((detail) => {
				const ready = detail.matches.filter(playable);
				if (detail.tournament.status !== 'in_progress' || ready.length === 0 || left === 0) {
					return okAsync(detail);
				}

				const completed = detail.matches.filter((m) => m.status === 'completed').length;
				return sequence(ready, (match) => this.playOut(run, slug, match.id))
					.andThen(() => this.detail(slug))
					.andThen((after) => {
						// A game that does not count would be played again forever.
						if (after.matches.filter((m) => m.status === 'completed').length === completed) {
							run.check('Every round finishes at least one match', false);
							return okAsync(after);
						}

						return rounds(left - 1);
					});
			});
		return rounds(MAX_ROUNDS).andThen((detail) => this.checkFinished(run, slug, detail));
	}

	private checkFinished(run: Run, slug: string, detail: TournamentDetail): Task<void> {
		const t = detail.tournament;
		run.check('Status is completed', t.status === 'completed', t.status);
		const unplaced = detail.participants.filter((p) => !p.placement).map((p) => p.alias);
		run.check('Everyone has a placement', unplaced.length === 0, unplaced.join(', '));
		run.check(
			'A "finished" update is posted',
			detail.posts.some((p) => p.kind === 'finished')
		);
		const lobbyIds = detail.matches.flatMap((m) => m.games.map((g) => g.lobbyId));
		return ResultAsync.combine([
			inParallel(detail.participants, 4, (p) =>
				this.inbox(p.user, t).map((rows) =>
					rows.some(
						(row) =>
							row.title === `You won ${t.name}!` ||
							row.title.startsWith(`${t.name} is over: you finished #`)
					)
						? null
						: p.alias
				)
			),
			fromPb(
				this.pb.collection('hidden_matches').getFullList<{ id: string }>({
					filter: this.pb.filter('tournament = {:id}', { id: t.id }),
					fields: 'id'
				}),
				'Could not load hidden matches'
			),
			this.lobbiesById(lobbyIds),
			this.claims(t.id),
			guard(() => this.services.tournamentStats.stats(slug, true)),
			guard(() => this.services.tournamentStats.hallOfFame())
		]).map(([missing, hidden, lobbies, claims, stats, fame]) => {
			const names = missing.filter(Boolean);
			run.check('Everyone hears their place', names.length === 0, names.join(', '));
			const stillHidden = lobbies.filter((lobby) => lobby.isHidden).length;
			run.check(
				'The tournament games are public again',
				hidden.length === 0 && stillHidden === 0,
				`${hidden.length} hidden rules, ${stillHidden} hidden lobbies`
			);
			const counted = claims.filter((claim) => claim.status === 'counted').length;
			run.check(
				'Stats count every simulated game',
				stats.games === counted,
				`${stats.games} in stats, ${counted} played`
			);
			run.check(
				'The hall of fame lists the tournament',
				fame.tournaments.some((entry) => entry.tournament.id === t.id)
			);
		});
	}

	// ── Games ───────────────────────────────────────────────────────────────

	/** Plays games until the match is decided (or a game fails). */
	private playOut(run: Run, slug: string, matchId: string): Task<void> {
		const next = (played: number): Task<void> =>
			this.detail(slug).andThen((detail) => {
				const match = detail.matches.find((m) => m.id === matchId);
				if (!match || !playable(match)) {
					return played === 0 ? okAsync(undefined) : this.checkDecided(run, detail, matchId);
				}

				if (played >= match.bestOf) {
					run.check(`${this.label(detail, match)} is decided after ${played} games`, false);
					return okAsync(undefined);
				}

				return this.playGame(run, detail, match, played + 1).andThen((ok) =>
					ok ? next(played + 1) : okAsync(undefined)
				);
			});
		return next(0);
	}

	/** One game through the real flow: arm, claim, the Relic result, the sync job. */
	private playGame(
		run: Run,
		detail: TournamentDetail,
		match: TournamentMatch,
		number: number
	): Task<boolean> {
		const t = detail.tournament;
		const games = this.services.tournamentGames;
		const name = `${this.label(detail, match)} game ${number}`;
		return this.seats(detail, match).andThen(([a, b]) =>
			this.acceptAll(run, detail, false)
				.andThen(() =>
					this.expectOk(run, `${name}: ${a.alias} starts the tournament game`, () =>
						games.arm(a.user, match.id)
					)
				)
				.andThen((armed) =>
					armed ? this.nextSession().map((session): number | null => session) : okAsync(null)
				)
				.andThen((session) =>
					session === null
						? okAsync(null)
						: this.expectOk(run, `${name}: the lobby with both players is claimed`, () =>
								games.claim(a.user, match.id, session, [a.steamId, b.steamId])
							).map((claimed) => (claimed === null ? null : session))
				)
				.andThen((session) => {
					if (session === null) {
						return okAsync(false);
					}

					return ResultAsync.combine([
						this.claimFor(session),
						this.detail(t.slug),
						this.hiddenRule(session)
					])
						.andThen(([claim, during, hidden]) => {
							const live = during.matches.find((m) => m.id === match.id);
							run.check(
								`${name}: claim is playing`,
								claim?.status === 'playing',
								claim?.status ?? 'missing'
							);
							run.check(
								`${name}: the match shows as live`,
								!!live?.playing && during.tournament.liveCount >= 1,
								`playing ${!!live?.playing}, liveCount ${during.tournament.liveCount}`
							);
							run.check(`${name}: the session is hidden`, hidden);
							const before = { winsA: live?.winsA ?? 0, winsB: live?.winsB ?? 0 };
							const winner = this.pickWinner(a.seed, b.seed);
							return this.finishGame(a.user.id, session, a, b, winner).map((lobbyId) => ({
								lobbyId,
								winner,
								before
							}));
						})
						.andThen(({ lobbyId, winner, before }) =>
							this.lobbyHidden(lobbyId)
								.andThen((hidden) => {
									run.check(`${name}: the lobby stays hidden while the tournament runs`, hidden);
									return this.expectOk(run, `${name}: sync job runs`, () =>
										this.services.tournaments.sync()
									);
								})
								.andThen(() => ResultAsync.combine([this.claimFor(session), this.detail(t.slug)]))
								.andThen(([claim, after]) => {
									const scored = after.matches.find((m) => m.id === match.id);
									const winnerSeat = winner === 'A' ? a : b;
									run.note(
										`${name}: ${winnerSeat.alias} wins (lobby ${lobbyId}, session ${session}).`
									);
									run.check(
										`${name}: claim is counted`,
										claim?.status === 'counted' && claim.lobby === lobbyId,
										claim ? `${claim.status} ${claim.lobby}` : 'missing'
									);
									const expected = winner === 'A' ? before.winsA + 1 : before.winsB + 1;
									const actual = winner === 'A' ? scored?.winsA : scored?.winsB;
									run.check(
										`${name}: ${winnerSeat.alias}'s wins go up`,
										actual === expected,
										`${scored?.winsA ?? '?'}–${scored?.winsB ?? '?'}`
									);
									return guard(() => games.mine(winnerSeat.user)).map((mine) => {
										run.check(
											`${name}: ${winnerSeat.alias} gets the result popup`,
											mine.results.some((result) => result.lobbyId === lobbyId)
										);
										return actual === expected;
									});
								})
						)
						.orElse((error) => {
							run.check(`${name} finished`, false, error.message);
							return okAsync(false);
						});
				})
		);
	}

	/** After the deciding game: the winner (and loser) moved on, or the standings changed. */
	private checkDecided(run: Run, detail: TournamentDetail, matchId: string): Task<void> {
		const match = detail.matches.find((m) => m.id === matchId);
		if (!match) {
			return okAsync(undefined);
		}

		const name = this.label(detail, match);
		run.check(`${name} is completed`, match.status === 'completed', match.status);
		if (detail.tournament.format === 'round_robin') {
			const row = detail.standings.find((s) => s.participant === match.winner);
			run.check(
				`${name}: standings show the win`,
				!!row && row.wins > 0,
				row ? `${row.wins} wins` : 'missing'
			);
			return okAsync(undefined);
		}

		const loser = match.winner === match.playerA ? match.playerB : match.playerA;
		const moved = (nextId: string | null, slot: string | null, who: string | null) => {
			const next = detail.matches.find((m) => m.id === nextId);
			return !!next && (slot === 'A' ? next.playerA : next.playerB) === who;
		};
		if (match.nextMatch) {
			run.check(
				`${name}: ${this.alias(detail, match.winner)} moves on`,
				moved(match.nextMatch, match.nextSlot, match.winner)
			);
			const next = detail.matches.find((m) => m.id === match.nextMatch);
			if (next?.playerA && next.playerB && next.status !== 'completed') {
				run.check(`${name}: the next match is ready`, next.status === 'ready', next.status);
			}
		}

		if (match.loserNextMatch && loser) {
			run.check(
				`${name}: ${this.alias(detail, loser)} drops to the losers bracket`,
				moved(match.loserNextMatch, match.loserNextSlot, loser)
			);
		}

		if (detail.tournament.status === 'completed') {
			run.note('That was the last match: the tournament is completed.');
		}

		return okAsync(undefined);
	}

	/** Lower seeds win more often. */
	private pickWinner(seedA: number | null, seedB: number | null): 'A' | 'B' {
		const a = seedA ?? 8;
		const b = seedB ?? 8;
		return Math.random() < b / (a + b) ? 'A' : 'B';
	}

	/** The finished lobby as the app and the result fill would leave it, then processed. */
	private finishGame(
		owner: string,
		session: number,
		a: GamePlayer,
		b: GamePlayer,
		winner: 'A' | 'B'
	): Task<string> {
		const map = pick(SIM_MAPS);
		const duration = 600 + Math.floor(Math.random() * 3000);
		const completed = Math.floor(Date.now() / 1000);
		const races = Math.random() < 0.5 ? [pick([0, 2]), pick([1, 3])] : [pick([1, 3]), pick([0, 2])];
		const seats = [a, b].map((p, i) => ({
			p,
			race: races[i],
			outcome: (i === 0) === (winner === 'A') ? 1 : 0
		}));
		return fromPb(
			this.pb.collection('lobbies').create<{ id: string }>({
				user: owner,
				sessionId: session,
				title: '1 VS. 1',
				map,
				isRanked: false,
				needsResult: false,
				durationSeconds: duration,
				matchtypeId: 1,
				playerCount: 2,
				players: seats.map(({ p, race }, i) => ({
					index: i,
					playerId: p.profileId,
					profile: { alias: p.alias, country: p.country, profile_id: p.profileId },
					race,
					steamId: p.steamId,
					team: i,
					slot: i,
					type: 0
				})),
				result: {
					id: session,
					mapname: map,
					matchtype_id: 1,
					maxplayers: 2,
					description: 'AUTOMATCH',
					startgametime: completed - duration,
					completiontime: completed,
					players: seats.map(({ p, race, outcome }, i) => ({
						alias: p.alias,
						profile_id: p.profileId,
						steamId: p.steamId,
						race_id: race,
						teamid: i,
						outcome,
						resulttype: outcome,
						country: p.country
					}))
				}
			}),
			'Could not create the simulated game'
		).andThen(({ id }) => this.services.lobbies.process(id).map(() => id));
	}

	// ── Jobs ────────────────────────────────────────────────────────────────

	/** What the `tournament-deadlines` job runs (`routes/api/internal/jobs/[name]`), step by step. */
	private deadlinesJob(run: Run): Task<void> {
		const { tournamentGames, tournamentNotices, tournaments, tournamentSchedule } = this.services;
		const parts: [string, () => Task<unknown>][] = [
			['notifyOverdue', () => tournamentGames.notifyOverdue()],
			['notices.run', () => tournamentNotices.run()],
			['closeDue', () => tournaments.closeDue()],
			['schedule.remind', () => tournamentSchedule.remind()]
		];
		return sequence(parts, ([label, fn]) =>
			guard(fn)
				.map((value) => {
					run.note(`Deadlines job ${label}: ${JSON.stringify(value)}`);
				})
				.orElse((error) => {
					run.check(`Deadlines job ${label}`, false, error.message);
					return okAsync(undefined);
				})
		).map(() => undefined);
	}

	// ── Reset ───────────────────────────────────────────────────────────────

	private reset(run: Run): Task<void> {
		return this.list()
			.andThen((tournaments) =>
				sequence(tournaments, (t) =>
					fromPb(
						this.pb.collection('tournaments').update(t.id, { featuredMatch: '', winner: '' }),
						'Could not clear the simulation'
					).andThen(() =>
						fromPb(
							this.pb.collection('tournaments').delete(t.id),
							'Could not delete the simulation'
						)
					)
				).map(() =>
					run.note(
						`Deleted ${tournaments.length} simulated tournaments (with their matches, players, posts, claims, reports and notifications).`
					)
				)
			)
			.andThen(() => this.deleteSimNotifications(run))
			.andThen(() => this.deleteSimLobbies(run))
			.andThen(() => this.deleteBots(run))
			.andThen(() => all([uncache('hidden:rules'), uncache('hidden:lobby-ids')]))
			.andThen(() => ResultAsync.combine([this.list(), this.botIds(), this.simLobbies()]))
			.map(([tournaments, bots, lobbies]) => {
				run.check(
					'No simulated tournaments left',
					tournaments.length === 0,
					`${tournaments.length}`
				);
				run.check('No bot accounts left', bots.size === 0, `${bots.size}`);
				run.check('No simulated games left', lobbies.length === 0, `${lobbies.length}`);
			});
	}

	/** Staff notices without a tournament relation (overdue) that link to a simulation. */
	private deleteSimNotifications(run: Run): Task<void> {
		return fromPb(
			this.pb.collection('notifications').getFullList<{ id: string; url: string }>({
				filter: 'url ~ "/tournaments/sim-"',
				fields: 'id,url'
			}),
			'Could not load notifications'
		)
			.andThen((rows) => {
				const sim = rows.filter((row) => SIM_URL.test(row.url));
				return inParallel(sim, 5, (row) =>
					fromPb(
						this.pb.collection('notifications').delete(row.id),
						'Could not delete a notification'
					)
				).map(() => run.note(`Deleted ${sim.length} other notifications linking to a simulation.`));
			})
			.map(() => undefined);
	}

	private simLobbies(): Task<{ id: string; sessionId: number }[]> {
		return fromPb(
			this.pb.collection('lobbies').getFullList<{ id: string; sessionId: number }>({
				filter: this.pb.filter('sessionId > {:from} && sessionId < {:to}', {
					from: SESSION_BASE,
					to: SESSION_END
				}),
				fields: 'id,sessionId'
			}),
			'Could not load the simulated games'
		);
	}

	/** Games (their index rows cascade), the reputation they earned and leftover hide rules. */
	private deleteSimLobbies(run: Run): Task<void> {
		const reputation = this.pb.collection('user_reputation');
		return this.simLobbies()
			.andThen((lobbies) =>
				inParallel(lobbies, 4, (lobby) =>
					fromPb(
						reputation.getFullList<{ id: string; user: string }>({
							filter: this.pb.filter('source = {:id}', { id: lobby.id }),
							fields: 'id,user'
						}),
						'Could not load reputation'
					).andThen((rows) =>
						inParallel(rows, 4, (row) =>
							fromPb(reputation.delete(row.id), 'Could not delete reputation')
						).map(() => rows.map((row) => row.user))
					)
				).andThen((users) =>
					inParallel(lobbies, 5, (lobby) =>
						fromPb(
							this.pb.collection('lobbies').delete(lobby.id),
							'Could not delete a simulated game'
						)
					).map(() => {
						run.note(`Deleted ${lobbies.length} simulated games.`);
						return [...new Set(users.flat())];
					})
				)
			)
			.andThen((users) =>
				this.botIds().andThen((bots) => {
					const real = users.filter((id) => !bots.has(id));
					return inParallel(real, 3, (id) => this.services.reputation.refreshUserTotal(id)).map(
						() => {
							if (real.length > 0) {
								run.note(`Recounted the reputation of ${real.length} real accounts.`);
							}
						}
					);
				})
			)
			.andThen(() =>
				fromPb(
					this.pb.collection('hidden_matches').getFullList<{ id: string }>({
						filter: this.pb.filter('sessionId > {:from} && sessionId < {:to}', {
							from: SESSION_BASE,
							to: SESSION_END
						}),
						fields: 'id'
					}),
					'Could not load hidden matches'
				)
			)
			.andThen((rows) =>
				inParallel(rows, 5, (row) =>
					fromPb(
						this.pb.collection('hidden_matches').delete(row.id),
						'Could not delete a hide rule'
					)
				)
			)
			.map(() => undefined);
	}

	/** Bot notifications nobody else got, the bots (participants, claims, reports cascade) and their players rows. */
	private deleteBots(run: Run): Task<void> {
		return this.botIds()
			.andThen((bots) =>
				inParallel([...bots], 3, (id) =>
					fromPb(
						this.pb
							.collection('notifications')
							.getFullList<{ id: string; recipients: string[]; targetAll: boolean }>({
								filter: this.pb.filter('recipients.id ?= {:id}', { id }),
								fields: 'id,recipients,targetAll'
							}),
						'Could not load notifications'
					)
				).andThen((lists) => {
					const only = new Map(
						lists
							.flat()
							.filter((row) => !row.targetAll && row.recipients.every((id) => bots.has(id)))
							.map((row) => [row.id, row])
					);
					return inParallel([...only.keys()], 5, (id) =>
						fromPb(
							this.pb.collection('notifications').delete(id),
							'Could not delete a notification'
						)
					)
						.andThen(() =>
							inParallel([...bots], 3, (id) =>
								fromPb(this.pb.collection('users').delete(id), 'Could not delete a bot')
							)
						)
						.map(() =>
							run.note(`Deleted ${bots.size} bot accounts and ${only.size} of their notifications.`)
						);
				})
			)
			.andThen(() =>
				fromPb(
					this.pb
						.collection('players')
						.getFullList<{ id: string; profile_id: number; steam_id: string }>({
							filter: this.pb.filter('profile_id > {:from} && profile_id < {:to}', {
								from: PROFILE_BASE,
								to: PROFILE_BASE + 100_000
							}),
							fields: 'id,profile_id,steam_id'
						}),
					'Could not load players'
				)
			)
			.andThen((rows) => {
				const bots = rows.filter((row) => row.steam_id?.startsWith(BOT_STEAM_PREFIX));
				return inParallel(bots, 5, (row) =>
					fromPb(this.pb.collection('players').delete(row.id), 'Could not delete a players row')
				).map(() => run.note(`Deleted ${bots.length} bot players rows.`));
			})
			.map(() => undefined);
	}

	// ── Helpers ─────────────────────────────────────────────────────────────

	/** `ok` → a passing check and the value; an error → a failing check and null. */
	private expectOk<T>(run: Run, label: string, fn: () => Task<T>): Task<T | null> {
		return guard(fn)
			.map((value): T | null => {
				run.check(label, true);
				return value;
			})
			.orElse((error) => {
				run.check(label, false, error.message);
				return okAsync(null);
			});
	}

	/** The call has to be refused. */
	private expectErr<T>(run: Run, label: string, fn: () => Task<T>): Task<void> {
		return guard(fn)
			.map(() => {
				run.check(label, false, 'It was allowed');
			})
			.orElse((error) => {
				run.check(label, true, error.message);
				return okAsync(undefined);
			});
	}

	private detail(slug: string): Task<TournamentDetail> {
		return guard(() => this.services.tournaments.get(slug, true));
	}

	private load(slug: string): Task<{ detail: TournamentDetail; settings: Settings }> {
		return SIM_SLUG.test(slug)
			? this.detail(slug).map((detail) => ({
					detail,
					settings: parseSettings(detail.tournament.description)
				}))
			: errAsync(badRequest('Not a simulated tournament.'));
	}

	/** Without the rules check the spare got in and would take a bot's place. */
	private dropSpare(run: Run, slug: string, spare: Bot): Task<void> {
		return this.detail(slug).andThen((detail) =>
			detail.participants.some((p) => p.user === spare.user.id)
				? guard(() => this.services.tournaments.withdraw(detail.tournament.id, spare.user.id))
						.map(() => run.note(`Withdrew ${spare.alias} again.`))
						.orElse(() => okAsync(undefined))
				: okAsync(undefined)
		);
	}

	/** Everyone who has not accepted the current rules does (except you with `skipMe`). */
	private acceptAll(run: Run, detail: TournamentDetail, skipMe: boolean): Task<void> {
		const me = parseSettings(detail.tournament.description).me;
		const pending = detail.participants.filter(
			(p) => p.status === 'registered' && !p.rulesAccepted && (!skipMe || p.user !== me)
		);
		return sequence(pending, (p) =>
			this.userOf(p.user).andThen((user) =>
				guard(() => this.services.tournaments.acceptRules(detail.tournament.id, user))
					.map(() => run.note(`${p.alias} accepts the current rules.`))
					.orElse((error) => {
						run.check(`${p.alias} accepts the current rules`, false, error.message);
						return okAsync(undefined);
					})
			)
		).map(() => undefined);
	}

	/** Both players of a match as accounts the simulator can act as. */
	private seats(detail: TournamentDetail, match: TournamentMatch): Task<[Seat, Seat]> {
		const a = detail.participants.find((p) => p.id === match.playerA);
		const b = detail.participants.find((p) => p.id === match.playerB);
		if (!a || !b) {
			return errAsync(notFound('Match players not found.'));
		}

		return ResultAsync.combine([this.userOf(a.user), this.userOf(b.user)]).map(([userA, userB]) => [
			{ ...a, user: userA },
			{ ...b, user: userB }
		]);
	}

	private userOf(userId: string): Task<AuthUserPublic> {
		return fromPb(
			this.pb
				.collection('users')
				.getOne<UserRecord>(userId, { fields: 'id,email,name,steamIds,role,verified' }),
			'Could not load the account'
		).map(toAuthUser);
	}

	private label(detail: TournamentDetail, match: TournamentMatch): string {
		const bracket =
			match.bracket === 'winners'
				? 'R'
				: match.bracket === 'losers'
					? 'L'
					: match.bracket === 'grand_final'
						? 'GF'
						: 'RR';
		return `${bracket}${match.round}.${match.position} ${this.alias(detail, match.playerA)} vs ${this.alias(detail, match.playerB)}`;
	}

	private alias(detail: TournamentDetail, participantId: string | null): string {
		return detail.participants.find((p) => p.id === participantId)?.alias ?? 'TBD';
	}

	/** The user's notifications of this tournament (also the ones that only link to it), newest first. */
	private inbox(userId: string, tournament: { id: string; slug: string }): Task<NotificationRow[]> {
		return fromPb(
			this.pb.collection('notifications').getFullList<NotificationRow>({
				filter: this.pb.filter('recipients.id ?= {:user} && (tournament = {:id} || url = {:url})', {
					user: userId,
					id: tournament.id,
					url: `${SITE_URL}/tournaments/${tournament.slug}`
				}),
				sort: '-created',
				fields: 'id,title,created'
			}),
			'Could not load notifications'
		);
	}

	private claims(tournamentId: string): Task<ClaimRow[]> {
		return fromPb(
			this.pb.collection('tournament_claims').getFullList<ClaimRow>({
				filter: this.pb.filter('tournament = {:id}', { id: tournamentId }),
				sort: 'created',
				fields: 'id,tournament,match,participant,status,sessionId,lobby'
			}),
			'Could not load the tournament games'
		);
	}

	private claimFor(sessionId: number): Task<ClaimRow | null> {
		return pbMaybe(
			this.pb
				.collection('tournament_claims')
				.getFirstListItem<ClaimRow>(this.pb.filter('sessionId = {:sessionId}', { sessionId })),
			'Could not load the tournament game'
		);
	}

	private hiddenRule(sessionId: number): Task<boolean> {
		return fromPb(
			this.pb.collection('hidden_matches').getList(1, 1, {
				filter: this.pb.filter('sessionId = {:sessionId} && tournament != ""', { sessionId }),
				skipTotal: true
			}),
			'Could not load hidden matches'
		).map((rows) => rows.items.length > 0);
	}

	private lobbyHidden(lobbyId: string): Task<boolean> {
		return fromPb(
			this.pb.collection('lobbies').getOne<{ isHidden: boolean }>(lobbyId, { fields: 'isHidden' }),
			'Could not load the simulated game'
		).map((lobby) => Boolean(lobby.isHidden));
	}

	private lobbiesById(ids: string[]): Task<{ id: string; isHidden: boolean }[]> {
		return inParallel(ids, 5, (id) =>
			pbMaybe(
				this.pb
					.collection('lobbies')
					.getOne<{ id: string; isHidden: boolean }>(id, { fields: 'id,isHidden' }),
				'Could not load the simulated game'
			)
		).map((rows) => rows.filter((row): row is { id: string; isHidden: boolean } => !!row));
	}

	private nextSession(): Task<number> {
		if (this.sessionCursor !== null) {
			return okAsync(++this.sessionCursor);
		}

		const highest = (collection: string) =>
			fromPb(
				this.pb.collection(collection).getList<{ sessionId: number }>(1, 1, {
					filter: this.pb.filter('sessionId > {:from} && sessionId < {:to}', {
						from: SESSION_BASE,
						to: SESSION_END
					}),
					sort: '-sessionId',
					fields: 'sessionId',
					skipTotal: true
				}),
				'Could not pick a session id'
			).map((rows) => Number(rows.items[0]?.sessionId) || SESSION_BASE);
		return ResultAsync.combine([highest('lobbies'), highest('tournament_claims')]).map(
			([lobbies, claims]) => {
				this.sessionCursor = Math.max(lobbies, claims) + 1;
				return this.sessionCursor;
			}
		);
	}

	private nextNumber(): Task<number> {
		return this.list().map(
			(rows) => 1 + Math.max(0, ...rows.map((row) => Number(SIM_SLUG.exec(row.slug)?.[1] ?? 0)))
		);
	}

	/** Your linked Steam account that has a players row (needed to sign up). */
	private playableSteamId(run: Run, staff: AuthUserPublic): Task<string | null> {
		const steamIds = staff.steamIds ?? [];
		return sequence(steamIds, (steamId) =>
			pbMaybe(
				this.pb
					.collection('players')
					.getFirstListItem<{ id: string }>(this.pb.filter('steam_id = {:steamId}', { steamId }), {
						fields: 'id'
					})
			).map((row) => (row ? steamId : null))
		).map((found) => {
			const steamId = found.find(Boolean) ?? null;
			run.check(
				'You can play along (a linked Steam account the site has seen play)',
				!!steamId,
				steamId ?? 'No linked Steam account with a players row: the simulation runs with bots only.'
			);
			return steamId;
		});
	}

	private botIds(): Task<Set<string>> {
		return fromPb(
			this.pb.collection('users').getFullList<{ id: string; email: string }>({
				filter: 'email ~ "dev-sim-%"',
				fields: 'id,email'
			}),
			'Could not load the bots'
		).map(
			(rows) =>
				new Set(rows.filter((row) => BOT_EMAIL_PATTERN.test(row.email)).map((row) => row.id))
		);
	}

	private ensureBots(count: number): Task<Bot[]> {
		return inParallel(
			Array.from({ length: count }, (_, i) => i + 1),
			4,
			(n) => this.ensureBot(n)
		);
	}

	/** A bot account with a linked Steam id, a players row and the desktop app "installed". */
	private ensureBot(n: number): Task<Bot> {
		const users = this.pb.collection('users');
		const email = BOT_EMAIL(n);
		const steamId = BOT_STEAM(n);
		const profileId = PROFILE_BASE + n;
		const alias = CALL_SIGNS[(n - 1) % CALL_SIGNS.length] + (n > CALL_SIGNS.length ? ` ${n}` : '');
		const fields = {
			name: `Sim ${alias}`,
			steamIds: [steamId],
			meta: { version: BOT_VERSION },
			verified: true
		};
		return pbMaybe(
			users.getFirstListItem<UserRecord>(this.pb.filter('email = {:email}', { email })),
			'Could not load a bot'
		)
			.andThen((existing) => {
				if (existing) {
					return fromPb(users.update<UserRecord>(existing.id, fields), 'Could not update a bot');
				}

				const password = `DevSim-${crypto.randomUUID()}`;
				return fromPb(
					users.create<UserRecord>({ ...fields, email, password, passwordConfirm: password }),
					'Could not create a bot'
				);
			})
			.andThen((record) =>
				pbMaybe(
					this.pb
						.collection('players')
						.getFirstListItem<{ id: string }>(this.pb.filter('steam_id = {:steamId}', { steamId })),
					'Could not load a bot player'
				)
					.andThen((player) =>
						fromPb(
							player
								? this.pb.collection('players').update(player.id, { profile_id: profileId, alias })
								: this.pb
										.collection('players')
										.create({ profile_id: profileId, alias, steam_id: steamId }),
							'Could not save a bot player'
						)
					)
					.map(() => ({ n, user: toAuthUser(record), steamId, profileId, alias }))
			);
	}
}

function summary(rows: NotificationRow[]): SimNotifications {
	return { count: rows.length, latest: rows.slice(0, 3).map((row) => row.title) };
}
