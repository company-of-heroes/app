/// <reference path="../pb_data/types.d.ts" />

// Source-of-truth counts computed from the social tables. The stored likeCount /
// commentCount / downloadCount columns stay (history sorts on them, old apps read
// them) but are recomputed from these views instead of being incremented.
//
// Download counts: one row per signed-in user in lobby_downloads, plus one per
// anonymous download event. An anonymous event stores several fingerprints in the
// same request, so fingerprints are grouped per second.

const VIEWS = [
	{
		name: 'lobby_social_counts',
		query: `SELECT l.id,
			CAST((SELECT COALESCE(SUM(k.value), 0) FROM lobby_likes k WHERE k.lobby = l.id) AS INTEGER) AS likeCount,
			CAST((SELECT COUNT(*) FROM lobby_comments c WHERE c.lobby = l.id AND COALESCE(c.deleted, 0) = 0) AS INTEGER) AS commentCount,
			CAST((SELECT COUNT(*) FROM lobby_downloads d WHERE d.lobby = l.id)
				+ (SELECT COUNT(DISTINCT substr(f.created, 1, 19)) FROM lobby_download_fingerprints f WHERE f.lobby = l.id) AS INTEGER) AS downloadCount
			FROM lobbies l`
	},
	{
		name: 'replay_social_counts',
		query: `SELECT r.id,
			CAST((SELECT COALESCE(SUM(k.value), 0) FROM replay_likes k WHERE k.replay = r.id) AS INTEGER) AS likeCount,
			CAST((SELECT COUNT(*) FROM replay_comments c WHERE c.replay = r.id AND COALESCE(c.deleted, 0) = 0) AS INTEGER) AS commentCount,
			CAST((SELECT COUNT(DISTINCT substr(f.created, 1, 19)) FROM member_replay_download_fingerprints f WHERE f.replay = r.id) AS INTEGER) AS downloadCount
			FROM replays r`
	},
	{
		name: 'lobby_comment_scores',
		query: `SELECT c.id,
			CAST((SELECT COALESCE(SUM(k.value), 0) FROM lobby_comment_likes k WHERE k.comment = c.id) AS INTEGER) AS likeCount
			FROM lobby_comments c`
	},
	{
		name: 'replay_comment_scores',
		query: `SELECT c.id,
			CAST((SELECT COALESCE(SUM(k.value), 0) FROM replay_comment_likes k WHERE k.comment = c.id) AS INTEGER) AS likeCount
			FROM replay_comments c`
	}
];

migrate(
	(app) => {
		for (const view of VIEWS) {
			app.save(
				new Collection({
					type: 'view',
					name: view.name,
					listRule: '',
					viewRule: '',
					viewQuery: view.query
				})
			);
		}
	},
	(app) => {
		for (const view of VIEWS) {
			try {
				app.delete(app.findCollectionByNameOrId(view.name));
			} catch {
				// already removed
			}
		}
	}
);
