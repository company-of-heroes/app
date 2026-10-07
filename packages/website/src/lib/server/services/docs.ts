import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import {
	loadGameDocs,
	type BuildingPage,
	type CommanderPage,
	type DocKind,
	type DocWeaponRow,
	type DocsOverview,
	type GameDocs,
	type UnitPage,
	type WeaponPage
} from '@company-of-heroes/game-data';
import { cached, uncache } from '../cache';
import { badRequest, notFound, rateLimited } from '../errors';
import { ensure, fromAsync, fromPb, pbMaybe, type Task } from '../result';
import { Service } from './service';

export const DOCS_NOTE_MAX = 5000;
export const DOCS_REPORT_MAX = 2000;
const DOCS_REPORTS_PER_HOUR = 5;

export type DocsNote = { body: string; updated: string };

type WithNote<T> = T & { note: DocsNote | null };

type NoteRecord = { id: string; body: string; updated: string };

const noteKey = (kind: DocKind, slug: string) => `docs:note:${kind}:${slug}`;

/**
 * Unit, building, commander and weapon documentation: generated game data
 * (`@company-of-heroes/game-data`) plus one staff-written tip per item (`docs_notes`).
 */
export class DocsService extends Service {
	private data(): Task<GameDocs> {
		return fromAsync(loadGameDocs(), 'Could not load game data');
	}

	private exists(docs: GameDocs, kind: DocKind, slug: string): boolean {
		const items = {
			unit: docs.units,
			building: docs.buildings,
			commander: docs.commanders,
			weapon: docs.weapons
		};
		return items[kind].has(slug);
	}

	private page<T>(
		kind: DocKind,
		slug: string,
		build: (docs: GameDocs) => T | undefined
	): Task<WithNote<T>> {
		return this.data().andThen((docs) => {
			const page = build(docs);
			if (!page) {
				return errAsync(notFound('Not found'));
			}

			// The game data does not need PocketBase; a failing tip lookup only hides the tip.
			return this.note(kind, slug)
				.orElse(() => okAsync(null))
				.map((note) => ({ ...page, note }));
		});
	}

	overview(): Task<DocsOverview> {
		return this.data().map((docs) => docs.overview());
	}

	weapons(): Task<DocWeaponRow[]> {
		return this.data().map((docs) => docs.weaponList());
	}

	/** Every docs page path, for the sitemap. */
	paths(): Task<string[]> {
		return this.data().map((docs) => docs.paths());
	}

	unit(slug: string): Task<WithNote<UnitPage>> {
		return this.page('unit', slug, (docs) => docs.unitPage(slug));
	}

	building(slug: string): Task<WithNote<BuildingPage>> {
		return this.page('building', slug, (docs) => docs.buildingPage(slug));
	}

	commander(slug: string): Task<WithNote<CommanderPage>> {
		return this.page('commander', slug, (docs) => docs.commanderPage(slug));
	}

	weapon(slug: string): Task<WithNote<WeaponPage>> {
		return this.page('weapon', slug, (docs) => docs.weaponPage(slug));
	}

	private noteRecord(kind: DocKind, slug: string): Task<NoteRecord | null> {
		return pbMaybe(
			this.pb
				.collection('docs_notes')
				.getFirstListItem<NoteRecord>(
					this.pb.filter('kind = {:kind} && slug = {:slug}', { kind, slug }),
					{
						fields: 'id,body,updated'
					}
				),
			'Could not load the tip'
		);
	}

	note(kind: DocKind, slug: string): Task<DocsNote | null> {
		return cached(noteKey(kind, slug), 60, () =>
			this.noteRecord(kind, slug).map((record) =>
				record?.body ? { body: record.body, updated: record.updated } : null
			)
		);
	}

	/** Staff only (checked by the caller). An empty body removes the tip. */
	saveNote(kind: DocKind, slug: string, rawBody: string, staffId: string): Task<DocsNote | null> {
		const body = rawBody.trim();
		const notes = this.pb.collection('docs_notes');
		return ensure(body.length <= DOCS_NOTE_MAX, badRequest('The tip is too long.'))
			.asyncAndThen(() => this.data())
			.andThen((docs) =>
				this.exists(docs, kind, slug) ? okAsync(docs) : errAsync(notFound('Not found'))
			)
			.andThen(() => this.noteRecord(kind, slug))
			.andThen((record) => {
				if (!body) {
					return record
						? fromPb(notes.delete(record.id), 'Could not remove the tip').map(() => null)
						: okAsync(null);
				}

				const data = { kind, slug, body, updatedBy: staffId };
				return (
					record
						? fromPb(notes.update<NoteRecord>(record.id, data), 'Could not save the tip')
						: fromPb(notes.create<NoteRecord>(data), 'Could not save the tip')
				).map((saved) => ({ body: saved.body, updated: saved.updated }));
			})
			.andThen((note) => uncache(noteKey(kind, slug)).map(() => note));
	}

	/**
	 * A signed-in user reports wrong info on a wiki page (`url` is absolute, checked by the
	 * caller). Stored in `docs_reports`; every admin and moderator gets a notification.
	 */
	report(input: {
		url: string;
		page: string;
		description: string;
		reporterId: string;
	}): Task<void> {
		const description = input.description.trim();
		const page = input.page.trim().slice(0, 200) || 'Wiki';
		const since = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace('T', ' ');
		return ensure(description.length > 0, badRequest('Describe what is wrong.'))
			.andThen(() =>
				ensure(description.length <= DOCS_REPORT_MAX, badRequest('The report is too long.'))
			)
			.asyncAndThen(() =>
				fromPb(
					this.pb.collection('docs_reports').getList(1, 1, {
						filter: this.pb.filter('reporter = {:id} && created >= {:since}', {
							id: input.reporterId,
							since
						}),
						fields: 'id'
					}),
					'Could not check your reports'
				)
			)
			.andThen((recent) =>
				recent.totalItems < DOCS_REPORTS_PER_HOUR
					? okAsync(undefined)
					: errAsync(rateLimited('You sent a lot of reports. Try again later.'))
			)
			.andThen(() =>
				fromPb(
					this.pb.collection('docs_reports').create({
						reporter: input.reporterId,
						page,
						url: input.url,
						description,
						status: 'open'
					}),
					'Could not send the report'
				)
			)
			.andThen(() => this.notifyStaff({ ...input, page, description }));
	}

	private notifyStaff(input: {
		url: string;
		page: string;
		description: string;
		reporterId: string;
	}): Task<void> {
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('users').getFullList<{ id: string }>({
					filter: 'role = "admin" || role = "moderator"',
					fields: 'id'
				}),
				'Could not load staff'
			),
			fromPb(
				this.pb
					.collection('users')
					.getOne<{ name: string }>(input.reporterId, { fields: 'name' })
					.catch(() => null)
			)
		]).andThen(([staff, reporter]) => {
			// Every admin and moderator, also when staff report a page themselves.
			const recipients = staff.map((user) => user.id);
			if (recipients.length === 0) {
				return okAsync(undefined);
			}

			const name = reporter?.name?.trim() || 'Someone';
			const quote = input.description
				.split('\n')
				.map((line) => `> ${line}`)
				.join('\n');
			return fromPb(
				this.pb.collection('notifications').create({
					title: `Wiki report: ${input.page}`.slice(0, 200),
					body: `**${name}** reported an issue on [${input.page}](${input.url}):\n\n${quote}`,
					targetAll: false,
					recipients,
					url: input.url,
					createdBy: input.reporterId
				}),
				'Could not notify staff'
			).map(() => undefined);
		});
	}
}
