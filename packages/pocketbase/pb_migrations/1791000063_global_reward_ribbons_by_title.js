/// <reference path="../pb_data/types.d.ts" />

// Follow-up to 1791000053: these rewards count for every faction but use a faction ribbon.
// 053 matched record ids of another database, so production kept its faction ribbons; this
// one matches by title and production's current ribbon. Three Abreast (any 3v3 win) was
// missing there. Only rows that still have the old ribbon change, and only to a ribbon no
// other reward uses, so a ribbon staff picked since is kept.

const SWAPS = [
	['Blitzkrieg', 'ribbon-026', 'ribbon-318'],
	['War of Attrition', 'ribbon-052', 'ribbon-319'],
	['Rails and Metal', 'ribbon-002', 'ribbon-320'],
	['Langres Garrison', 'ribbon-077', 'ribbon-321'],
	['Dressed for Parade', 'ribbon-003', 'ribbon-324'],
	['Old Guard', 'ribbon-053', 'ribbon-310'],
	['Last Stand', 'ribbon-027', 'ribbon-311'],
	['Three Abreast', 'ribbon-076', 'ribbon-325']
];

function inUse(app, ribbon) {
	try {
		app.findFirstRecordByFilter('rewards', 'ribbon = {:ribbon}', { ribbon });
		return true;
	} catch {
		return false;
	}
}

function swap(app, reverse) {
	for (const [title, before, after] of SWAPS) {
		const [oldRibbon, newRibbon] = reverse ? [after, before] : [before, after];
		let record;
		try {
			record = app.findFirstRecordByFilter('rewards', 'title = {:title} && ribbon = {:ribbon}', {
				title,
				ribbon: oldRibbon
			});
		} catch {
			continue;
		}

		if (inUse(app, newRibbon)) {
			continue;
		}

		record.set('ribbon', newRibbon);
		app.save(record);
	}
}

migrate(
	(app) => swap(app, false),
	(app) => swap(app, true)
);
