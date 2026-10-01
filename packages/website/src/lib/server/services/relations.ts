import { ok, okAsync } from 'neverthrow';
import { uniquePeers } from '../domain/users';
import { fromPb, sequence, type Task } from '../result';
import { Service } from './service';

/** A field somewhere that points at a collection, found from the schema (never a hand-kept list). */
type Relation = { collection: string; field: string; multiple: boolean; peers: string[][] };
type Row = Record<string, unknown> & { id: string };
type CollectionSchema = {
	name: string;
	type: string;
	indexes: string[];
	fields: { name: string; type: string; collectionId?: string; maxSelect?: number }[];
};

/**
 * Moves every row pointing at one record (the loser) to another (the keeper) when
 * duplicates are merged. A row the keeper already has by a unique index is dropped.
 */
export class RelationsService extends Service {
	#collections?: CollectionSchema[];

	private collections(): Task<CollectionSchema[]> {
		if (this.#collections) {
			return okAsync(this.#collections);
		}

		return fromPb(
			this.pb.collections.getFullList<CollectionSchema>(),
			'Could not load collections'
		).map((collections) => (this.#collections = collections));
	}

	/** Every relation field to `target` in a base collection, with its unique-index peers. */
	private relationsTo(target: string, skip: string[]): Task<Relation[]> {
		return this.collections().map((collections) =>
			collections
				.filter((collection) => collection.type === 'base' && !skip.includes(collection.name))
				.flatMap((collection) =>
					collection.fields
						.filter((field) => field.type === 'relation' && field.collectionId === target)
						.map((field) => ({
							collection: collection.name,
							field: field.name,
							multiple: (field.maxSelect ?? 1) > 1,
							peers: uniquePeers(collection.indexes ?? [], field.name)
						}))
				)
		);
	}

	/** Would the keeper already have this row (by a unique index)? Loser ids among the peers count as the keeper. */
	private keeperHasTwin(
		relation: Relation,
		row: Row,
		loserId: string,
		keeperId: string
	): Task<boolean> {
		return sequence(relation.peers, (peers) => {
			const conditions = [
				this.pb.filter(`${relation.field} = {:keeper}`, { keeper: keeperId }),
				...peers.map((peer) =>
					this.pb.filter(`${peer} = {:value}`, {
						value: row[peer] === loserId ? keeperId : row[peer]
					})
				)
			];
			return fromPb(
				this.pb
					.collection(relation.collection)
					.getList(1, 1, { filter: conditions.join(' && '), fields: 'id', skipTotal: true }),
				'Could not load rows'
			).map((twin) => twin.items.length > 0);
		}).map((twins) => twins.some(Boolean));
	}

	/** Moves one row from the loser to the keeper (or drops it when the keeper has its twin). */
	private moveRow(relation: Relation, row: Row, loserId: string, keeperId: string) {
		const collection = this.pb.collection(relation.collection);
		if (relation.multiple) {
			const ids = (row[relation.field] as string[]).map((id) => (id === loserId ? keeperId : id));
			return fromPb(collection.update(row.id, { [relation.field]: [...new Set(ids)] }));
		}

		return this.keeperHasTwin(relation, row, loserId, keeperId).andThen((twin) =>
			twin
				? fromPb(collection.delete(row.id))
				: fromPb(collection.update(row.id, { [relation.field]: keeperId }))
		);
	}

	/** Moves one relation's rows; returns how many could not be moved. */
	private moveRelation(relation: Relation, loserId: string, keeperId: string): Task<number> {
		return fromPb(
			this.pb.collection(relation.collection).getFullList<Row>({
				filter: this.pb.filter(`${relation.field} ${relation.multiple ? '?=' : '='} {:loser}`, {
					loser: loserId
				})
			}),
			'Could not load rows'
		).andThen((rows) =>
			sequence(rows, (row) =>
				this.moveRow(relation, row, loserId, keeperId)
					.map(() => 0)
					.orElse((error) => {
						console.warn('[relations] merge: could not move', relation.collection, row.id, error);
						return ok(1);
					})
			).map((failures) => failures.reduce((sum, failed) => sum + failed, 0))
		);
	}

	/**
	 * Moves everything in `target` relations from the loser to the keeper; returns how
	 * many rows could not be moved. `skip`: collections the caller rebuilds itself.
	 */
	move(target: string, loserId: string, keeperId: string, skip: string[] = []): Task<number> {
		return this.relationsTo(target, skip)
			.andThen((relations) =>
				sequence(relations, (relation) => this.moveRelation(relation, loserId, keeperId))
			)
			.map((failures) => failures.reduce((sum, failed) => sum + failed, 0));
	}
}
