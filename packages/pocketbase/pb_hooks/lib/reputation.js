'use strict';

function recordId(value) {
	if (!value) return '';
	if (typeof value === 'object' && value.id) return String(value.id);
	return String(value);
}

function addSteamId(found, value) {
	if (!value) return;
	let steam = String(value).trim();
	if (steam.startsWith('/steam/')) steam = steam.slice('/steam/'.length);
	if (steam) found[steam] = true;
}

function querySteamIds(sql, lobbyId) {
	try {
		const rows = arrayOf(new DynamicModel({ steamId: '' }));
		$app.db().newQuery(sql).bind({ lobby: lobbyId }).all(rows);
		return rows;
	} catch (error) {
		console.warn('[reputation] steam query', String(error?.message || error));
		return [];
	}
}

function collectLobbySteamIds(lobbyId) {
	const found = Object.create(null);
	const queries = [
		`SELECT DISTINCT steam_id AS steamId FROM lobby_player_index
		 WHERE lobby = {:lobby} AND steam_id IS NOT NULL AND steam_id != ''`,
		`SELECT DISTINCT CAST(json_extract(p.value, '$.steamId') AS TEXT) AS steamId
		 FROM json_each((
			 SELECT CASE WHEN json_valid(lobbyPlayers) THEN lobbyPlayers ELSE '[]' END
			 FROM lobbies WHERE id = {:lobby}
		 )) AS p
		 WHERE json_extract(p.value, '$.steamId') IS NOT NULL
			 AND json_extract(p.value, '$.steamId') != ''`,
		`SELECT DISTINCT CAST(json_extract(p.value, '$.steamId') AS TEXT) AS steamId
		 FROM json_each((
			 SELECT CASE
				 WHEN json_valid(result) AND json_type(json_extract(result, '$.players')) = 'array'
				 THEN json_extract(result, '$.players')
				 ELSE '[]'
			 END
			 FROM lobbies WHERE id = {:lobby}
		 )) AS p
		 WHERE json_extract(p.value, '$.steamId') IS NOT NULL
			 AND json_extract(p.value, '$.steamId') != ''`
	];
	for (const sql of queries) {
		for (const row of querySteamIds(sql, lobbyId)) addSteamId(found, row.steamId);
	}
	return Object.keys(found);
}

function findUserIdsBySteamIds(steamIds) {
	if (!steamIds.length) return [];
	const bindings = {};
	const placeholders = [];
	for (let i = 0; i < steamIds.length; i++) {
		const key = 'sid' + i;
		bindings[key] = steamIds[i];
		placeholders.push('{:' + key + '}');
	}
	try {
		const rows = arrayOf(new DynamicModel({ id: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT u.id AS id
				 FROM users u, json_each(
					 CASE WHEN json_valid(u.steamIds) THEN u.steamIds ELSE '[]' END
				 ) AS s
				 WHERE CAST(s.value AS TEXT) IN (${placeholders.join(', ')})`
			)
			.bind(bindings)
			.all(rows);
		return rows.map((row) => String(row.id)).filter(Boolean);
	} catch (error) {
		console.warn('[reputation] find users by steam', String(error?.message || error));
		return [];
	}
}

function findTypeByTrigger(trigger) {
	if (!trigger) return null;
	try {
		return $app.findFirstRecordByFilter('reputation_types', 'trigger = {:trigger}', { trigger });
	} catch {
		return null;
	}
}

function findLedger(userId, typeId, sourceId) {
	try {
		return $app.findFirstRecordByFilter(
			'user_reputation',
			'user = {:user} && type = {:type} && source = {:source}',
			{ user: userId, type: typeId, source: sourceId }
		);
	} catch {
		return null;
	}
}

function adjustTotals(userId, typeId, delta) {
	if (!userId || !typeId || !delta) return;
	try {
		let total;
		try {
			total = $app.findFirstRecordByFilter(
				'user_reputation_totals',
				'user = {:user} && type = {:type}',
				{ user: userId, type: typeId }
			);
		} catch {
			total = new Record($app.findCollectionByNameOrId('user_reputation_totals'));
			total.set('user', userId);
			total.set('type', typeId);
			total.set('total', 0);
		}

		total.set('total', (Number(total.get('total')) || 0) + delta);
		$app.save(total);
	} catch (error) {
		console.warn('[reputation] totals', String(error?.message || error));
	}

	try {
		const user = $app.findRecordById('users', userId);
		user.set('reputation', (Number(user.get('reputation')) || 0) + delta);
		$app.save(user);
	} catch (error) {
		console.warn('[reputation] user total', String(error?.message || error));
	}
}

function award(userId, trigger, sourceId) {
	const user = recordId(userId);
	const source = recordId(sourceId);
	if (!user || !trigger || !source) return;
	try {
		const type = findTypeByTrigger(trigger);
		if (!type || type.get('enabled') === false) return;
		const score = Number(type.get('score')) || 0;
		if (!score) return;
		if (findLedger(user, type.id, source)) return;
		const record = new Record($app.findCollectionByNameOrId('user_reputation'));
		record.set('user', user);
		record.set('type', type.id);
		record.set('amount', score);
		record.set('source', source);
		$app.save(record);
		adjustTotals(user, type.id, score);
	} catch (error) {
		console.warn('[reputation] award', trigger, String(error?.message || error));
	}
}

function revoke(userId, trigger, sourceId) {
	const user = recordId(userId);
	const source = recordId(sourceId);
	if (!user || !trigger || !source) return;
	try {
		const type = findTypeByTrigger(trigger);
		if (!type) return;
		const existing = findLedger(user, type.id, source);
		if (!existing) return;
		const amount = Number(existing.get('amount')) || 0;
		$app.delete(existing);
		if (amount) {
			adjustTotals(user, type.id, -amount);
		}
	} catch (error) {
		console.warn('[reputation] revoke', trigger, String(error?.message || error));
	}
}

function setVoteReputation({ voterId, authorId, sourceId, value, prefix }) {
	const voter = recordId(voterId);
	const author = recordId(authorId);
	const source = recordId(sourceId);
	if (!source || !prefix) return;
	const receivedUp = prefix + '_received_upvote';
	const receivedDown = prefix + '_received_downvote';
	const castUp = prefix + '_cast_upvote';
	const castDown = prefix + '_cast_downvote';
	if (author) {
		revoke(author, receivedUp, source);
		revoke(author, receivedDown, source);
	}

	if (voter) {
		revoke(voter, castUp, source);
		revoke(voter, castDown, source);
	}

	if (value !== 1 && value !== -1) return;
	const self = Boolean(voter && author && voter === author);
	if (self) return;
	if (author) {
		award(author, value === 1 ? receivedUp : receivedDown, source);
	}

	if (voter) {
		award(voter, value === 1 ? castUp : castDown, source);
	}
}

function lobbyUploaderId(lobbyId) {
	const id = recordId(lobbyId);
	if (!id) return '';
	try {
		return recordId($app.findRecordById('lobbies', id).get('user'));
	} catch {
		return '';
	}
}

function commentAuthorId(commentId) {
	const id = recordId(commentId);
	if (!id) return '';
	try {
		return recordId($app.findRecordById('lobby_comments', id).get('user'));
	} catch {
		// try member replay comments
	}
	try {
		return recordId($app.findRecordById('replay_comments', id).get('user'));
	} catch {
		return '';
	}
}

function syncReplayVote(likeRecord, value) {
	setVoteReputation({
		voterId: likeRecord.get('user'),
		authorId: lobbyUploaderId(likeRecord.get('lobby')),
		sourceId: likeRecord.id,
		value,
		prefix: 'replay'
	});
}

function memberReplayUploaderId(replayId) {
	const id = recordId(replayId);
	if (!id) {
		return '';
	}

	try {
		return recordId($app.findRecordById('replays', id).get('createdBy'));
	} catch {
		return '';
	}
}

function syncMemberReplayVote(likeRecord, value) {
	setVoteReputation({
		voterId: likeRecord.get('user'),
		authorId: memberReplayUploaderId(likeRecord.get('replay')),
		sourceId: likeRecord.id,
		value,
		prefix: 'replay'
	});
}

function syncCommentVote(likeRecord, value) {
	setVoteReputation({
		voterId: likeRecord.get('user'),
		authorId: commentAuthorId(likeRecord.get('comment')),
		sourceId: likeRecord.id,
		value,
		prefix: 'comment'
	});
}

function userSteamIds(userId) {
	const id = recordId(userId);
	if (!id) {
		return [];
	}

	try {
		const user = $app.findRecordById('users', id);
		const raw = user.get('steamIds');
		let list = raw;
		if (typeof raw === 'string') {
			try {
				list = JSON.parse(raw);
			} catch {
				list = [];
			}
		}

		if (!Array.isArray(list)) {
			return [];
		}

		return list
			.map((value) => {
				let steam = String(value || '').trim();
				if (steam.startsWith('/steam/')) {
					steam = steam.slice('/steam/'.length);
				}

				return steam;
			})
			.filter(Boolean);
	} catch {
		return [];
	}
}

function syncPlayerVote(likeRecord, value) {
	const steamId = String(likeRecord.get('steamId') || '').trim();
	const voterId = recordId(likeRecord.get('user'));
	const authorIds = findUserIdsBySteamIds(steamId ? [steamId] : []);
	const authorId = authorIds[0] || '';
	const self = Boolean(voterId && steamId && userSteamIds(voterId).indexOf(steamId) !== -1);
	setVoteReputation({
		voterId,
		authorId: self ? voterId : authorId,
		sourceId: likeRecord.id,
		value,
		prefix: 'player'
	});
}

function awardCommentCreated(comment) {
	award(comment.get('user'), 'comment_created', comment.id);
}

function revokeCommentCreated(comment) {
	revoke(comment.get('user'), 'comment_created', comment.id);
}

function awardReplayDownload({ uploaderId, downloaderId, sourceId }) {
	const uploader = recordId(uploaderId);
	const downloader = recordId(downloaderId);
	const source = recordId(sourceId);
	if (!source) return;
	const self = Boolean(uploader && downloader && uploader === downloader);
	if (self) return;
	if (uploader) {
		award(uploader, 'replay_received_download', source);
	}

	if (downloader) {
		award(downloader, 'replay_cast_download', source);
	}
}

function awardMatchPlayed(lobbyId) {
	const id = recordId(lobbyId);
	if (!id) return;
	const userIds = findUserIdsBySteamIds(collectLobbySteamIds(id));
	for (let i = 0; i < userIds.length; i++) {
		award(userIds[i], 'match_played', id);
	}
}

function restoreUserReputation(e) {
	if (e.hasSuperuserAuth()) {
		e.next();
		return;
	}

	try {
		const original = e.record.original();
		e.record.set('reputation', original.get('reputation'));
	} catch (error) {
		console.warn('[reputation] restoreUserReputation', String(error?.message || error));
	}

	e.next();
}

function assertUniqueTrigger(record) {
	const trigger = String(record.get('trigger') || '').trim();
	if (!trigger) {
		throw new BadRequestError('Trigger is required.');
	}

	let existing = null;
	try {
		existing = $app.findFirstRecordByFilter('reputation_types', 'trigger = {:trigger}', { trigger });
	} catch {
		existing = null;
	}

	if (existing && existing.id !== record.id) {
		throw new BadRequestError('This trigger is already in use.');
	}
}

module.exports = {
	award,
	revoke,
	awardCommentCreated,
	revokeCommentCreated,
	awardMatchPlayed,
	awardReplayDownload,
	syncCommentVote,
	syncReplayVote,
	syncMemberReplayVote,
	syncPlayerVote,
	restoreUserReputation,
	assertUniqueTrigger,
	lobbyUploaderId,
	recordId,
	setVoteReputation
};
