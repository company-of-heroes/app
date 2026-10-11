/// <reference path="../pb_data/types.d.ts" />

// Ribbons now carry their faction's edge stripes. These rewards count for every faction but
// used a faction ribbon, so they move to an unused global one. Only rows that still have the
// old ribbon change, so a ribbon staff picked since is kept.

const SWAPS = [
	['1uz4rr3d056rfmq', 'ribbon-026', 'ribbon-315'], // Blitzkrieg
	['ifov22tb31334oy', 'ribbon-051', 'ribbon-308'], // War of Attrition
	['nbozprbxd55cs9u', 'ribbon-001', 'ribbon-312'], // Rails and Metal
	['d6ocqnema9qecuh', 'ribbon-076', 'ribbon-313'], // Langres Garrison
	['85mtdjcy7d1v6om', 'ribbon-002', 'ribbon-323'], // Dressed for Parade
	['pxng3m6gbp59dc3', 'ribbon-052', 'ribbon-322'], // Old Guard
	['5p59adk2l0plb9l', 'ribbon-027', 'ribbon-317'] // Last Stand
];

function swap(app, reverse) {
	for (const [id, before, after] of SWAPS) {
		const [oldRibbon, newRibbon] = reverse ? [after, before] : [before, after];
		let record;
		try {
			record = app.findRecordById('rewards', id);
		} catch {
			continue;
		}

		if (record.getString('ribbon') !== oldRibbon) {
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
