/// <reference path="../pb_data/types.d.ts" />

// The app still writes its own private replays straight to `replays` (create,
// publish/unpublish via `visibility`). Uploading, editing and deleting public
// member replays go through the website. These rules make direct writes owner-only
// and keep the counters (recomputed by the website from the social views) out of
// reach. An empty `visibility` is private everywhere, so the create hook that
// defaulted it is gone.
const PREVIOUS = {
	createRule: '@request.auth.id != ""',
	updateRule:
		'(createdBy = @request.auth.id) && @request.body.likeCount:isset = false && @request.body.commentCount:isset = false && @request.body.downloadCount:isset = false'
};

const COUNTERS_UNTOUCHED =
	'@request.body.likeCount:isset = false && @request.body.commentCount:isset = false && @request.body.downloadCount:isset = false';

migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		replays.createRule = `@request.auth.id != "" && @request.body.createdBy = @request.auth.id && ${COUNTERS_UNTOUCHED}`;
		replays.updateRule = `createdBy = @request.auth.id && @request.body.createdBy:isset = false && ${COUNTERS_UNTOUCHED}`;
		app.save(replays);
	},
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		Object.assign(replays, PREVIOUS);
		app.save(replays);
	}
);
