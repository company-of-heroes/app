import { errAsync, okAsync } from 'neverthrow';
import type {
	MyTournamentHostRequest,
	TournamentHost,
	TournamentHostDecision,
	TournamentHostRequest,
	TournamentHostRequestInput,
	TournamentHostRequestStatus
} from '@company-of-heroes/api/tournaments';
import { canHostTournaments, type AuthUserPublic } from '$lib/auth/user';
import { SITE_URL } from '$lib/site/urls';
import { badRequest, notFound } from '../errors';
import { ensure, fromPb, pbMaybe, type Task } from '../result';
import { Service } from './service';

type UserRef = { id: string; name?: string; role?: string };

type RequestRecord = {
	id: string;
	user: string;
	message: string;
	discord: string;
	status: TournamentHostRequestStatus;
	staffNote: string;
	handledBy: string;
	handledAt: string;
	created: string;
	expand?: { user?: UserRef; handledBy?: UserRef };
};

/** Handled requests shown under the open ones in the staff list. */
const RECENT_HANDLED = 30;

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');
const nameOf = (user: UserRef | undefined) => user?.name?.trim() || 'Unknown player';

function toMine(record: RequestRecord): MyTournamentHostRequest {
	return {
		id: record.id,
		message: record.message ?? '',
		discord: record.discord ?? '',
		status: record.status,
		staffNote: record.staffNote ?? '',
		created: record.created,
		handledAt: record.handledAt || null
	};
}

function toRequest(record: RequestRecord): TournamentHostRequest {
	const user = record.expand?.user;
	return {
		...toMine(record),
		user: { id: record.user, name: nameOf(user), role: user?.role || null },
		handledBy: record.handledBy
			? { id: record.handledBy, name: nameOf(record.expand?.handledBy) }
			: null
	};
}

/**
 * Community hosts (`tournament_host_requests`): a user asks to host tournaments, staff approve
 * (the user gets the `host` role) or decline with a note. Hosts create tournaments and run only
 * their own; staff can take the role away again.
 */
export class TournamentHostsService extends Service {
	private get requests() {
		return this.pb.collection('tournament_host_requests');
	}

	private get users() {
		return this.pb.collection('users');
	}

	/** The user's latest request, or null. */
	mine(user: AuthUserPublic): Task<MyTournamentHostRequest | null> {
		return fromPb(
			this.requests.getList<RequestRecord>(1, 1, {
				filter: this.pb.filter('user = {:user}', { user: user.id }),
				sort: '-created',
				skipTotal: true
			}),
			'Could not load your request'
		).map(({ items }) => (items[0] ? toMine(items[0]) : null));
	}

	request(user: AuthUserPublic, input: TournamentHostRequestInput): Task<MyTournamentHostRequest> {
		const message = input.message.trim();
		return ensure(!canHostTournaments(user), badRequest('You can already host tournaments.'))
			.andThen(() =>
				ensure(
					message.length >= 20,
					badRequest('Tell us a bit more about the tournament you want to host.')
				)
			)
			.asyncAndThen(() => this.mine(user))
			.andThen((latest) =>
				latest?.status === 'pending'
					? errAsync(badRequest('Your request is still waiting for staff.'))
					: okAsync(undefined)
			)
			.andThen(() =>
				fromPb(
					this.requests.create<RequestRecord>({
						user: user.id,
						message,
						discord: input.discord.trim(),
						status: 'pending'
					}),
					'Could not send your request'
				)
			)
			.andThen((record) =>
				this.notifyStaff(
					'New request to host tournaments',
					`**${nameOf(user)}** wants to host tournaments:\n\n> ${message.replace(/\n+/g, '\n> ')}` +
						(record.discord ? `\n\nDiscord: ${record.discord}` : '') +
						'\n\nApprove or decline it under Host requests on the tournaments page.'
				).map(() => toMine(record))
			);
	}

	/** Staff: open requests first (oldest first), then the latest handled ones. */
	list(): Task<TournamentHostRequest[]> {
		return fromPb(
			this.requests.getFullList<RequestRecord>({
				filter: 'status = "pending"',
				sort: 'created',
				expand: 'user,handledBy'
			}),
			'Could not load the host requests'
		).andThen((open) =>
			fromPb(
				this.requests.getList<RequestRecord>(1, RECENT_HANDLED, {
					filter: 'status != "pending"',
					sort: '-handledAt,-created',
					expand: 'user,handledBy',
					skipTotal: true
				}),
				'Could not load the host requests'
			).map(({ items }) => [...open, ...items].map(toRequest))
		);
	}

	/** Staff: approving gives the user the host role (staff keep their own role). */
	decide(
		staff: AuthUserPublic,
		requestId: string,
		decision: TournamentHostDecision
	): Task<TournamentHostRequest> {
		const staffNote = decision.staffNote.trim();
		return pbMaybe(
			this.requests.getOne<RequestRecord>(requestId, { expand: 'user' }),
			'Could not load the request'
		)
			.andThen((record) => (record ? okAsync(record) : errAsync(notFound('Request not found.'))))
			.andThen((record) =>
				ensure(record.status === 'pending', badRequest('This request was already handled.'))
					.asyncAndThen(() =>
						decision.status === 'approved' && !record.expand?.user?.role
							? fromPb(this.users.update(record.user, { role: 'host' }), 'Could not save the role')
							: okAsync(undefined)
					)
					.andThen(() =>
						fromPb(
							this.requests.update<RequestRecord>(
								record.id,
								{
									status: decision.status,
									staffNote,
									handledBy: staff.id,
									handledAt: pbDate(new Date())
								},
								{ expand: 'user,handledBy' }
							),
							'Could not save the decision'
						)
					)
			)
			.andThen((record) =>
				this.notify(
					[record.user],
					decision.status === 'approved'
						? 'You can now host tournaments'
						: 'Your request to host tournaments',
					(decision.status === 'approved'
						? 'Staff approved your request. Create your tournament on the tournaments page: it ' +
							'starts as a draft that only you and staff see until you open registration.'
						: 'Staff declined your request to host tournaments for now.') +
						(staffNote ? `\n\n**Staff:** ${staffNote}` : ''),
					`${SITE_URL}/tournaments${decision.status === 'approved' ? '/new' : ''}`
				).map(() => toRequest(record))
			);
	}

	/** Staff: everyone with the host role and how many tournaments they created. */
	hosts(): Task<TournamentHost[]> {
		return fromPb(
			this.users.getFullList<UserRef & { id: string }>({
				filter: 'role = "host"',
				sort: 'name',
				fields: 'id,name'
			}),
			'Could not load the hosts'
		).andThen((users) =>
			users.length === 0
				? okAsync([])
				: fromPb(
						this.pb.collection('tournaments').getFullList<{ createdBy: string }>({
							filter: users
								.map((user) => this.pb.filter('createdBy = {:id}', { id: user.id }))
								.join(' || '),
							fields: 'createdBy'
						}),
						'Could not load the hosts'
					).map((tournaments) =>
						users.map((user) => ({
							id: user.id,
							name: nameOf(user),
							tournaments: tournaments.filter((t) => t.createdBy === user.id).length
						}))
					)
		);
	}

	/** Staff: takes the host role away. Their tournaments stay; staff run them from now on. */
	revoke(userId: string): Task<void> {
		return pbMaybe(
			this.users.getOne<UserRef & { id: string }>(userId, { fields: 'id,name,role' }),
			'Could not load the user'
		)
			.andThen((user) =>
				user?.role === 'host' ? okAsync(user) : errAsync(notFound('This user is not a host.'))
			)
			.andThen((user) =>
				fromPb(this.users.update(user.id, { role: '' }), 'Could not save the role')
			)
			.andThen(() =>
				this.notify(
					[userId],
					'Your host role was removed',
					'Staff removed your host role. Your tournaments stay on the site and staff run them ' +
						'from now on. Contact staff if you have questions.',
					`${SITE_URL}/tournaments`
				)
			);
	}

	private notifyStaff(title: string, body: string): Task<void> {
		return fromPb(
			this.users.getFullList<{ id: string }>({
				filter: 'role = "admin" || role = "moderator"',
				fields: 'id'
			}),
			'Could not load staff'
		).andThen((staff) =>
			this.notify(
				staff.map((user) => user.id),
				title,
				body,
				`${SITE_URL}/tournaments?hostRequests=1`
			)
		);
	}

	/** A notice never fails the action that sent it. */
	private notify(recipients: string[], title: string, body: string, url: string): Task<void> {
		if (recipients.length === 0) {
			return okAsync(undefined);
		}

		return fromPb(
			this.pb.collection('notifications').create({
				title: title.slice(0, 200),
				body,
				targetAll: false,
				recipients,
				url
			}),
			'Could not notify'
		)
			.map(() => undefined)
			.orElse((error) => {
				console.error('[tournament-hosts] could not notify', error);
				return okAsync(undefined);
			});
	}
}
