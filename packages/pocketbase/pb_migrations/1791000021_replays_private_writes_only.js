/// <reference path="../pb_data/types.d.ts" />

// Direct `replays` writes (the app's own private replays) stay private: publishing goes
// through the website (POST /api/v1/member-replays/{id}/publish), which checks the file
// and freezes the ratings snapshot. Published and deleted replays are only changed there.
const COUNTERS_UNTOUCHED =
	'@request.body.likeCount:isset = false && @request.body.commentCount:isset = false && @request.body.downloadCount:isset = false';
const PREVIOUS = {
	createRule: `@request.auth.id != "" && @request.body.createdBy = @request.auth.id && ${COUNTERS_UNTOUCHED}`,
	updateRule: `createdBy = @request.auth.id && @request.body.createdBy:isset = false && ${COUNTERS_UNTOUCHED}`
};
const PRIVATE_ONLY =
	'@request.body.statsSnapshot:isset = false && (@request.body.visibility:isset = false || @request.body.visibility = "private")';

migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		replays.createRule = `${PREVIOUS.createRule} && ${PRIVATE_ONLY}`;
		replays.updateRule = `${PREVIOUS.updateRule} && visibility != "member" && visibility != "deleted" && ${PRIVATE_ONLY}`;
		app.save(replays);
	},
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		Object.assign(replays, PREVIOUS);
		app.save(replays);
	}
);
