import { errAsync, okAsync } from 'neverthrow';
import {
	loadGameDocs,
	type BuildingPage,
	type CommanderPage,
	type DocKind,
	type DocRef,
	type DocsOverview,
	type GameDocs,
	type UnitPage,
	type WeaponPage
} from '@company-of-heroes/game-data';
import { cached, uncache } from '../cache';
import { badRequest, notFound } from '../errors';
import { ensure, fromAsync, fromPb, pbMaybe, type Task } from '../result';
import { Service } from './service';

export const DOCS_NOTE_MAX = 5000;

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

	weapons(): Task<DocRef[]> {
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
}
