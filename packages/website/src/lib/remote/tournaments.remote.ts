import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { canHostTournaments, isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import {
	acceptTimeBody,
	featureBody,
	hostDecisionBody,
	hostRequestBody,
	matchDeadlineBody,
	matchTimeBody,
	matchResultBody,
	postBody,
	registrationBody,
	reportBody,
	reportUpdateBody,
	roundDeadlinesBody,
	scheduleBody,
	seedOrderBody,
	seenBody,
	tournamentInput,
	tournamentScope,
	tournamentUpdate
} from '$lib/server/tournament-params';

const id = z.string().min(1).max(140);

function signedIn() {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to join'));
	}

	return { services: locals.services, user: locals.user };
}

function staff() {
	const { locals } = getRequestEvent();
	if (!locals.user || !isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return { services: locals.services, user: locals.user };
}

/** Staff and community hosts (who may create tournaments). */
function hostUser() {
	const { locals } = getRequestEvent();
	if (!locals.user || !canHostTournaments(locals.user)) {
		error(403, locals.t('Only staff and tournament hosts can do that.'));
	}

	return { services: locals.services, user: locals.user };
}

/** Staff actions on one tournament: staff, or the host who created it. `id` is the real id. */
async function manager(tournamentId: string) {
	const { services, user } = signedIn();
	const id = await unwrapAsync(services.tournaments.managed(tournamentId, user));
	return { services, user, id };
}

export const listTournaments = query(tournamentScope, ({ scope }) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournaments.list(scope, locals.user ?? null));
});

export const listTournamentsWonBy = query(registrationBody.shape.steamId, (steamId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournaments.wonBy(steamId));
});

/** A command (not a query) so a reload after a change never comes from the query cache. */
export const fetchTournament = command(id, (idOrSlug) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournaments.get(idOrSlug, locals.user ?? null));
});

/** Image size and type are checked by the service. */
const images = z.object({
	banner: z.instanceof(File).nullable().optional(),
	logo: z.instanceof(File).nullable().optional(),
	clearBanner: z.boolean().optional(),
	clearLogo: z.boolean().optional()
});

export const createTournament = command(
	z.object({ input: tournamentInput, images }),
	({ input, images }) => {
		const { services, user } = hostUser();
		return unwrapAsync(services.tournaments.create(input, images, user.id));
	}
);

export const updateTournament = command(
	z.object({ id, input: tournamentUpdate, images }),
	async ({ id, input, images }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.update(m.id, input, images));
	}
);

export const listTournamentMaps = command(() =>
	unwrapAsync(getRequestEvent().locals.services.tournaments.listMaps())
);

export const createTournamentMap = command(
	z.object({ name: z.string().max(80), icon: z.instanceof(File).nullable() }),
	({ name, icon }) => {
		const { services, user } = hostUser();
		return unwrapAsync(services.tournaments.createMap(name, icon, user.id));
	}
);

export const joinTournament = command(
	registrationBody.extend({ id }),
	({ id, steamId, acceptRules }) => {
		const { services, user } = signedIn();
		return unwrapAsync(services.tournaments.register(id, user, steamId, acceptRules));
	}
);

export const acceptTournamentRules = command(id, (tournamentId) => {
	const { services, user } = signedIn();
	return unwrapAsync(services.tournaments.acceptRules(tournamentId, user));
});

export const withdrawFromTournament = command(id, (tournamentId) => {
	const { services, user } = signedIn();
	return unwrapAsync(services.tournaments.withdraw(tournamentId, user.id));
});

export const seedTournament = command(id, async (tournamentId) => {
	const m = await manager(tournamentId);
	return unwrapAsync(m.services.tournaments.seed(m.id));
});

export const setTournamentSeeds = command(seedOrderBody.extend({ id }), async ({ id, order }) => {
	const m = await manager(id);
	return unwrapAsync(m.services.tournaments.setSeeds(m.id, order));
});

export const startTournament = command(id, async (tournamentId) => {
	const m = await manager(tournamentId);
	return unwrapAsync(m.services.tournaments.start(m.id));
});

export const setTournamentMatchResult = command(
	z.object({ id, matchId: id, result: matchResultBody }),
	async ({ id, matchId, result }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.setMatchResult(m.id, matchId, result));
	}
);

export const disqualifyTournamentPlayer = command(
	z.object({ id, participantId: id }),
	async ({ id, participantId }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.disqualify(m.id, participantId));
	}
);

export const setTournamentRoundDeadlines = command(
	roundDeadlinesBody.extend({ id }),
	async ({ id, rounds }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.setRoundDeadlines(m.id, rounds));
	}
);

export const setTournamentMatchDeadline = command(
	matchDeadlineBody.extend({ id, matchId: id }),
	async ({ id, matchId, deadline }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.setMatchDeadline(m.id, matchId, deadline));
	}
);

export const createTournamentPost = command(postBody.extend({ id }), async ({ id, ...input }) => {
	const m = await manager(id);
	return unwrapAsync(m.services.tournaments.createPost(m.id, input, m.user.id));
});

export const updateTournamentPost = command(
	postBody.extend({ id, postId: id }),
	async ({ id, postId, ...input }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.updatePost(m.id, postId, input));
	}
);

export const deleteTournamentPost = command(
	z.object({ id, postId: id }),
	async ({ id, postId }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.deletePost(m.id, postId));
	}
);

export const reportTournamentMatch = command(
	reportBody.extend({ id, matchId: id }),
	({ id, matchId, ...report }) => {
		const { services, user } = signedIn();
		return unwrapAsync(services.tournaments.report(user, id, matchId, report));
	}
);

/** Polled by the tournament watcher; a command so it never comes from the query cache. */
export const myTournaments = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.tournamentGames.mine(user));
});

export const markTournamentGamesSeen = command(seenBody, (seen) => {
	const { services, user } = signedIn();
	return unwrapAsync(services.tournamentGames.markSeen(user, seen));
});

export const listTournamentReports = command(id, async (tournamentId) => {
	const m = await manager(tournamentId);
	return unwrapAsync(m.services.tournamentReports.list(m.id));
});

export const updateTournamentReport = command(
	reportUpdateBody.extend({ id, reportId: id }),
	async ({ id, reportId, ...update }) => {
		const { services, user, id: tournamentId } = await manager(id);
		return unwrapAsync(services.tournamentReports.update(user, tournamentId, reportId, update));
	}
);

export const proposeTournamentTimes = command(
	scheduleBody.extend({ id, matchId: id }),
	({ id, matchId, times }) => {
		const { services, user } = signedIn();
		return unwrapAsync(services.tournamentSchedule.propose(user, id, matchId, times));
	}
);

export const acceptTournamentTime = command(
	acceptTimeBody.extend({ id, matchId: id, proposalId: id }),
	({ id, matchId, proposalId, time }) => {
		const { services, user } = signedIn();
		return unwrapAsync(services.tournamentSchedule.accept(user, id, matchId, proposalId, time));
	}
);

export const declineTournamentTimes = command(
	z.object({ id, matchId: id, proposalId: id }),
	({ id, matchId, proposalId }) => {
		const { services, user } = signedIn();
		return unwrapAsync(services.tournamentSchedule.decline(user, id, matchId, proposalId));
	}
);

export const setTournamentMatchTime = command(
	matchTimeBody.extend({ id, matchId: id }),
	async ({ id, matchId, scheduledAt }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournamentSchedule.setTime(m.id, matchId, scheduledAt));
	}
);

export const featureTournamentMatch = command(
	featureBody.extend({ id }),
	async ({ id, matchId }) => {
		const m = await manager(id);
		return unwrapAsync(m.services.tournaments.feature(m.id, matchId));
	}
);

/** A query (it also renders on the server); a finished tournament's numbers no longer change. */
export const tournamentStats = query(id, (idOrSlug) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournamentStats.stats(idOrSlug, isStaffUser(locals.user)));
});

export const tournamentHallOfFame = query(() =>
	unwrapAsync(getRequestEvent().locals.services.tournamentStats.hallOfFame())
);

export const myTournamentHostRequest = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.tournamentHosts.mine(user));
});

export const requestTournamentHost = command(hostRequestBody, (input) => {
	const { services, user } = signedIn();
	return unwrapAsync(services.tournamentHosts.request(user, input));
});

export const listTournamentHostRequests = command(() =>
	unwrapAsync(staff().services.tournamentHosts.list())
);

export const decideTournamentHostRequest = command(
	hostDecisionBody.extend({ requestId: id }),
	({ requestId, ...decision }) => {
		const { services, user } = staff();
		return unwrapAsync(services.tournamentHosts.decide(user, requestId, decision));
	}
);

export const listTournamentHosts = command(() =>
	unwrapAsync(staff().services.tournamentHosts.hosts())
);

export const revokeTournamentHost = command(id, (userId) =>
	unwrapAsync(staff().services.tournamentHosts.revoke(userId))
);
