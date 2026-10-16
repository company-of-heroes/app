/// <reference path="../pb_data/types.d.ts" />

// The "Supporter" reward (give 50 upvotes) becomes "Cheerleader", so "Supporter" only means the
// paid subscription. Matched by title and its votes_cast condition, so the "Supporter — N
// months" rewards and the Supporter label are never touched. `rewards` is a small table.

function rename(app, from, to) {
	let record;
	try {
		record = app.findFirstRecordByFilter(
			'rewards',
			"title = {:title} && conditions ~ 'votes_cast'",
			{ title: from }
		);
	} catch {
		return;
	}

	record.set('title', to);
	app.save(record);
}

migrate(
	(app) => rename(app, 'Supporter', 'Cheerleader'),
	(app) => rename(app, 'Cheerleader', 'Supporter')
);
