import type { ResultAsync } from 'neverthrow';
import { sendV1, type ApiDeps } from '../deps';
import type { ApiError } from '../errors';
import { fromPbPromise, pbOptions } from '../pb';

export type DocsKind = 'unit' | 'building' | 'commander' | 'weapon' | 'map';

export type DocsTip = { body: string; updated: string };

type NoteRecord = { body: string; updated: string };

/** Staff tips and issue reports on the wiki pages. */
export class DocsApi {
	constructor(private deps: ApiDeps) {}

	/** The staff tip of a wiki page, or null when there is none (notes are public). */
	note(kind: DocsKind, slug: string): ResultAsync<DocsTip | null, ApiError> {
		const pb = this.deps.pocketbase;
		return fromPbPromise(
			pb.collection('docs_notes').getList<NoteRecord>(
				1,
				1,
				pbOptions(this.deps, {
					filter: pb.filter('kind = {:kind} && slug = {:slug}', { kind, slug }),
					fields: 'body,updated',
					skipTotal: true
				})
			),
			'Could not load the tip.'
		).map(({ items: [record] }) =>
			record?.body ? { body: record.body, updated: record.updated } : null
		);
	}

	/** Staff only; an empty body removes the tip. */
	saveNote(kind: DocsKind, slug: string, body: string): ResultAsync<DocsTip | null, ApiError> {
		return fromPbPromise(
			sendV1<DocsTip | null>(this.deps, '/docs/notes', {
				method: 'POST',
				body: { kind, slug, body }
			}),
			'Could not save the tip.'
		);
	}

	/** Signed in: reports wrong info on a wiki page (`path` like `/wiki/units/riflemen`). */
	report(input: { path: string; page: string; description: string }): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1<void>(this.deps, '/docs/reports', { method: 'POST', body: input }),
			'Could not send the report.'
		);
	}
}
