/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		const likeCount = lobbies.fields.getByName('likeCount');
		if (likeCount) {
			likeCount.min = null;
			app.save(lobbies);
		}

		const likes = app.findCollectionByNameOrId('lobby_likes');
		if (!likes.fields.getByName('value')) {
			likes.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobby_likes_value',
					max: 1,
					min: -1,
					name: 'value',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		likes.updateRule = 'user = @request.auth.id';
		app.save(likes);
	},
	(app) => {
		try {
			const lobbies = app.findCollectionByNameOrId('lobbies');
			const likeCount = lobbies.fields.getByName('likeCount');
			if (likeCount) {
				likeCount.min = 0;
				app.save(lobbies);
			}
		} catch {
			// already gone
		}

		try {
			const likes = app.findCollectionByNameOrId('lobby_likes');
			if (likes.fields.getByName('value')) {
				likes.fields.removeByName('value');
			}

			likes.updateRule = null;
			app.save(likes);
		} catch {
			// already gone
		}
	}
);
