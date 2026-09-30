/// <reference path="../pb_data/types.d.ts" />

// Social writes (votes, comments, comment votes, player votes) now go through the
// website (its API, and the api-gateway for older app versions), which keeps
// counters, notifications and reputation in step. Direct collection writes are
// closed so nothing can bypass that. Deploy the website + gateway first.
//
// - player_vote_scores: table maintained by hooks -> view over player_likes
// - user_reputation_totals: hook-maintained table nobody reads -> removed
//   (users.reputation is recomputed from the user_reputation ledger)

const SOCIAL_COLLECTIONS = [
	'lobby_likes',
	'replay_likes',
	'lobby_comments',
	'replay_comments',
	'lobby_comment_likes',
	'replay_comment_likes',
	'player_likes'
];

// Counters are recomputed by the website from the count views; clients may not set them.
const COUNTERS_UNTOUCHED =
	'@request.body.likeCount:isset = false && @request.body.commentCount:isset = false && @request.body.downloadCount:isset = false';
const COUNTER_GUARDED = {
	lobbies: '@request.auth.id != ""',
	replays: 'createdBy = @request.auth.id'
};

const OWN_ROW = 'user = @request.auth.id';
const CREATE_OWN = '@request.auth.id != "" && @request.body.user = @request.auth.id';
const COMMENT_UPDATE =
	'user = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator"';

migrate(
	(app) => {
		for (const name of SOCIAL_COLLECTIONS) {
			const collection = app.findCollectionByNameOrId(name);
			collection.createRule = null;
			collection.updateRule = null;
			collection.deleteRule = null;
			app.save(collection);
		}

		for (const [name, rule] of Object.entries(COUNTER_GUARDED)) {
			const collection = app.findCollectionByNameOrId(name);
			collection.updateRule = `(${rule}) && ${COUNTERS_UNTOUCHED}`;
			app.save(collection);
		}

		app.delete(app.findCollectionByNameOrId('player_vote_scores'));
		app.save(
			new Collection({
				type: 'view',
				name: 'player_vote_scores',
				listRule: '',
				viewRule: '',
				viewQuery:
					'SELECT MIN(id) AS id, steamId, CAST(SUM(value) AS INTEGER) AS likeCount FROM player_likes GROUP BY steamId'
			})
		);

		try {
			app.delete(app.findCollectionByNameOrId('user_reputation_totals'));
		} catch {
			// already removed
		}

		// users.reputation was incremented by hooks; set it from the ledger once.
		app
			.db()
			.newQuery(
				'UPDATE users SET reputation = COALESCE((SELECT SUM(amount) FROM user_reputation r WHERE r.user = users.id), 0)'
			)
			.execute();
	},
	(app) => {
		for (const name of SOCIAL_COLLECTIONS) {
			const collection = app.findCollectionByNameOrId(name);
			collection.createRule = CREATE_OWN;
			collection.updateRule = name.endsWith('_comments') ? COMMENT_UPDATE : OWN_ROW;
			collection.deleteRule = name.endsWith('_comments') ? null : OWN_ROW;
			app.save(collection);
		}

		for (const [name, rule] of Object.entries(COUNTER_GUARDED)) {
			const collection = app.findCollectionByNameOrId(name);
			collection.updateRule = rule;
			app.save(collection);
		}

		app.delete(app.findCollectionByNameOrId('player_vote_scores'));
		const scores = new Collection({
			type: 'base',
			name: 'player_vote_scores',
			listRule: '',
			viewRule: '',
			fields: [
				{ name: 'steamId', type: 'text', required: true },
				{ name: 'likeCount', type: 'number' },
				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: [
				'CREATE UNIQUE INDEX `idx_player_vote_scores_steam` ON `player_vote_scores` (`steamId`)'
			]
		});
		app.save(scores);
		app
			.db()
			.newQuery(
				"INSERT INTO player_vote_scores (id, steamId, likeCount, created, updated) SELECT MIN(id), steamId, SUM(value), strftime('%Y-%m-%d %H:%M:%fZ'), strftime('%Y-%m-%d %H:%M:%fZ') FROM player_likes GROUP BY steamId"
			)
			.execute();

		const users = app.findCollectionByNameOrId('users');
		const totals = new Collection({
			type: 'base',
			name: 'user_reputation_totals',
			listRule: null,
			viewRule: null,
			fields: [
				{ name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1 },
				{
					name: 'type',
					type: 'relation',
					collectionId: app.findCollectionByNameOrId('reputation_types').id,
					maxSelect: 1
				},
				{ name: 'total', type: 'number' },
				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: [
				'CREATE UNIQUE INDEX `idx_user_reputation_totals_user_type` ON `user_reputation_totals` (`user`, `type`)',
				'CREATE INDEX `idx_user_reputation_totals_user` ON `user_reputation_totals` (`user`)'
			]
		});
		app.save(totals);
		app
			.db()
			.newQuery(
				"INSERT INTO user_reputation_totals (id, user, type, total, created, updated) SELECT MIN(id), user, type, SUM(amount), strftime('%Y-%m-%d %H:%M:%fZ'), strftime('%Y-%m-%d %H:%M:%fZ') FROM user_reputation GROUP BY user, type"
			)
			.execute();
	}
);
