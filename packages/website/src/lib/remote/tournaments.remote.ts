import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import {
	acceptTimeBody,
	featureBody,
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

export const listTournaments = query(tournamentScope, ({ scope }) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournaments.list(scope, isStaffUser(locals.user)));
});

export const listTournamentsWonBy = query(registrationBody.shape.steamId, (steamId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournaments.wonBy(steamId));
});

/** A command (not a query) so a reload after a change never comes from the query cache. */
export const fetchTournament = command(id, (idOrSlug) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournaments.get(idOrSlug, isStaffUser(locals.user)));
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
		const { services, user } = staff();
		return unwrapAsync(services.tournaments.create(input, images, user.id));
	}
);

export const updateTournament = command(
	z.object({ id, input: tournamentUpdate, images }),
	({ id, input, images }) => unwrapAsync(staff().services.tournaments.update(id, input, images))
);

export const listTournamentMaps = command(() =>
	unwrapAsync(getRequestEvent().locals.services.tournaments.listMaps())
);

export const createTournamentMap = command(
	z.object({ name: z.string().max(80), icon: z.instanceof(File).nullable() }),
	({ name, icon }) => {
		const { services, user } = staff();
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

export const seedTournament = command(id, (tournamentId) =>
	unwrapAsync(staff().services.tournaments.seed(tournamentId))
);

export const setTournamentSeeds = command(seedOrderBody.extend({ id }), ({ id, order }) =>
	unwrapAsync(staff().services.tournaments.setSeeds(id, order))
);

export const startTournament = command(id, (tournamentId) =>
	unwrapAsync(staff().services.tournaments.start(tournamentId))
);

export const setTournamentMatchResult = command(
	z.object({ id, matchId: id, result: matchResultBody }),
	({ id, matchId, result }) =>
		unwrapAsync(staff().services.tournaments.setMatchResult(id, matchId, result))
);

export const disqualifyTournamentPlayer = command(
	z.object({ id, participantId: id }),
	({ id, participantId }) => unwrapAsync(staff().services.tournaments.disqualify(id, participantId))
);

export const setTournamentRoundDeadlines = command(
	roundDeadlinesBody.extend({ id }),
	({ id, rounds }) => unwrapAsync(staff().services.tournaments.setRoundDeadlines(id, rounds))
);

export const setTournamentMatchDeadline = command(
	matchDeadlineBody.extend({ id, matchId: id }),
	({ id, matchId, deadline }) =>
		unwrapAsync(staff().services.tournaments.setMatchDeadline(id, matchId, deadline))
);

export const createTournamentPost = command(postBody.extend({ id }), ({ id, ...input }) => {
	const { services, user } = staff();
	return unwrapAsync(services.tournaments.createPost(id, input, user.id));
});

export const updateTournamentPost = command(
	postBody.extend({ id, postId: id }),
	({ id, postId, ...input }) =>
		unwrapAsync(staff().services.tournaments.updatePost(id, postId, input))
);

export const deleteTournamentPost = command(z.object({ id, postId: id }), ({ id, postId }) =>
	unwrapAsync(staff().services.tournaments.deletePost(id, postId))
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

export const listTournamentReports = command(id, (tournamentId) =>
	unwrapAsync(staff().services.tournamentReports.list(tournamentId))
);

export const updateTournamentReport = command(
	reportUpdateBody.extend({ id, reportId: id }),
	({ id, reportId, ...update }) => {
		const { services, user } = staff();
		return unwrapAsync(services.tournamentReports.update(user, id, reportId, update));
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
	({ id, matchId, scheduledAt }) =>
		unwrapAsync(staff().services.tournamentSchedule.setTime(id, matchId, scheduledAt))
);

export const featureTournamentMatch = command(featureBody.extend({ id }), ({ id, matchId }) =>
	unwrapAsync(staff().services.tournaments.feature(id, matchId))
);

/** A query (it also renders on the server); a finished tournament's numbers no longer change. */
export const tournamentStats = query(id, (idOrSlug) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.tournamentStats.stats(idOrSlug, isStaffUser(locals.user)));
});

export const tournamentHallOfFame = query(() =>
	unwrapAsync(getRequestEvent().locals.services.tournamentStats.hallOfFame())
);
