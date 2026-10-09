import type {
	Tournament,
	TournamentFormat,
	TournamentMatch,
	TournamentPost,
	TournamentPostKind,
	TournamentStatus
} from './types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** English labels; callers pass them through `t()`. */
export const FORMAT_LABELS: Record<TournamentFormat, string> = {
	single_elim: 'Single elimination',
	double_elim: 'Double elimination',
	round_robin: 'Round robin'
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
	draft: 'Draft',
	registration: 'Registration open',
	seeding: 'Seeding',
	in_progress: 'In progress',
	completed: 'Finished',
	cancelled: 'Cancelled'
};

/** Statuses in which players can still sign up or withdraw. */
export const isOpen = (tournament: Tournament) =>
	tournament.status === 'registration' || tournament.status === 'seeding';

export function registrationClosed(tournament: Tournament): boolean {
	if (tournament.status !== 'registration') {
		return true;
	}

	const closes = tournament.registrationClosesAt
		? Date.parse(tournament.registrationClosesAt.replace(' ', 'T'))
		: NaN;
	return Number.isFinite(closes) && closes <= Date.now();
}

/** Home page: running tournaments, then the ones players can still sign up for. */
export const featuredTournaments = (active: Tournament[], upcoming: Tournament[]) => [
	...active,
	...upcoming.filter((tournament) => !registrationClosed(tournament))
];

export function isFull(tournament: Tournament): boolean {
	return (
		tournament.maxParticipants !== null && tournament.participantCount >= tournament.maxParticipants
	);
}

/** Column title of a bracket round, e.g. "Semifinals" or "Losers round 3". */
export function roundLabel(
	t: Translate,
	format: TournamentFormat,
	match: Pick<TournamentMatch, 'bracket' | 'round'>,
	rounds: number
): string {
	if (match.bracket === 'grand_final') {
		return match.round === 2 ? t('Grand final reset') : t('Grand final');
	}

	if (match.bracket === 'losers') {
		return match.round === rounds
			? t('Losers final')
			: t('Losers round {round}', { round: match.round });
	}

	if (match.bracket === 'round_robin') {
		return t('Round {round}', { round: match.round });
	}

	const fromEnd = rounds - match.round;
	if (format === 'double_elim') {
		return fromEnd === 0 ? t('Winners final') : t('Winners round {round}', { round: match.round });
	}

	if (fromEnd === 0) {
		return t('Final');
	}

	if (fromEnd === 1) {
		return t('Semifinals');
	}

	if (fromEnd === 2) {
		return t('Quarterfinals');
	}

	return t('Round {round}', { round: match.round });
}

/** `datetime-local` value (local time) of an ISO / PocketBase date. */
export function toLocalInput(value: string | null): string {
	if (!value) {
		return '';
	}

	const date = new Date(value.replace(' ', 'T'));
	if (!Number.isFinite(date.getTime())) {
		return '';
	}

	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO date of a `datetime-local` value, or null when empty. */
export function fromLocalInput(value: string): string | null {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** PocketBase dates use a space instead of `T`. */
export const parseTournamentDate = (value: string | null) =>
	value ? value.replace(' ', 'T') : null;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** When players get a deadline warning: this long before it, largest first. */
export const DEADLINE_WARNINGS = [3 * DAY, DAY, 3 * HOUR];

/** `soon`: less than a day left to play; `overdue`: past it without a result. */
export type DeadlineState = 'none' | 'open' | 'soon' | 'overdue';

export function deadlineState(
	match: Pick<TournamentMatch, 'status' | 'deadline'>,
	now = Date.now()
): DeadlineState {
	if (!match.deadline || match.status === 'completed') {
		return 'none';
	}

	const left = Date.parse(match.deadline) - now;
	return left < 0 ? 'overdue' : left < DAY ? 'soon' : 'open';
}

/** Time until a deadline, e.g. "2d 5h", "5h 12m" or "12m". */
export function timeLeft(t: Translate, deadline: string, now = Date.now()): string {
	const left = Math.max(0, Date.parse(deadline) - now);
	const days = Math.floor(left / DAY);
	const hours = Math.floor((left % DAY) / HOUR);
	const minutes = Math.floor((left % HOUR) / MINUTE);
	if (days > 0) {
		return t('{days}d {hours}h', { days, hours });
	}

	return hours > 0 ? t('{hours}h {minutes}m', { hours, minutes }) : t('{minutes}m', { minutes });
}

/** Badge label per kind of update; callers pass them through `t()`. */
export const POST_KIND_LABELS: Record<TournamentPostKind, string> = {
	announcement: 'Announcement',
	rules: 'Rules',
	schedule: 'Schedule',
	deadlines: 'Deadlines',
	disqualified: 'Disqualification',
	seeded: 'Registration',
	started: 'Started',
	finished: 'Finished',
	cancelled: 'Cancelled'
};

/** Title of an update: the staff title, else the wording of its automatic kind. */
export function postTitle(t: Translate, post: TournamentPost): string {
	if (post.title) {
		return post.title;
	}

	const alias = String(post.data.alias ?? '');
	switch (post.kind) {
		case 'rules':
			return t('The rules changed');
		case 'schedule':
			return t('New start time');
		case 'deadlines':
			return t('Deadlines changed');
		case 'disqualified':
			return t('{name} was disqualified', { name: alias || t('A player') });
		case 'seeded':
			return t('Registration is closed');
		case 'started':
			return t('The tournament has started');
		case 'finished':
			return t('The tournament is over');
		case 'cancelled':
			return t('The tournament was cancelled');
		default:
			return t(POST_KIND_LABELS[post.kind]);
	}
}

/** Plain text of an automatic update (staff bodies are markdown and render as they are). */
export function postSummary(
	t: Translate,
	post: TournamentPost,
	formatDateTime: (iso: string) => string
): string {
	switch (post.kind) {
		case 'rules':
			return t('Staff changed the rules. Read them again on the Info tab before your next game.');
		case 'schedule':
			return typeof post.data.startsAt === 'string' && post.data.startsAt
				? t('The tournament now starts on {date}.', {
						date: formatDateTime(parseTournamentDate(post.data.startsAt)!)
					})
				: t('The start time was removed. Staff will announce a new one.');
		case 'deadlines':
			return t('Staff changed the deadlines. Check when you have to play your match.');
		case 'disqualified':
			return t('Their open and later matches count as lost; their opponents go through.');
		case 'seeded':
			return t('The players are seeded. The bracket follows when the tournament starts.');
		case 'started':
			return t(
				'{count} players are in. Find your first match in the bracket or on the dashboard of the desktop app.',
				{ count: Number(post.data.players) || 0 }
			);
		case 'finished':
			return post.data.champion
				? t('{name} is the champion. Every game and replay is public now.', {
						name: String(post.data.champion)
					})
				: t('Every game and replay is public now.');
		case 'cancelled':
			return t('Staff cancelled the tournament. Its games are public now.');
		default:
			return '';
	}
}
