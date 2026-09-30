/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_908767333');

		// Allow multiple players in the same live lobby (one row per user).
		// Dashboard uniqueness is handled client-side by sessionId.
		unmarshal(
			{
				indexes: [
					'CREATE UNIQUE INDEX `idx_8p4C4GmHxi` ON `lobbies_live` (`user`)',
					'CREATE INDEX `idx_U7Dm80Lyix` ON `lobbies_live` (\n  `map`,\n  `sessionId`\n)'
				]
			},
			collection
		);

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_908767333');

		unmarshal(
			{
				indexes: [
					'CREATE UNIQUE INDEX `idx_8p4C4GmHxi` ON `lobbies_live` (`user`)',
					'CREATE INDEX `idx_U7Dm80Lyix` ON `lobbies_live` (\n  `map`,\n  `sessionId`\n)',
					'CREATE UNIQUE INDEX `idx_ufN7vdqOgf` ON `lobbies_live` (`sessionId`)'
				]
			},
			collection
		);

		return app.save(collection);
	}
);
