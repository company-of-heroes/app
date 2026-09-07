'use strict';

function reputation() {
	return require(`${__hooks}/lib/reputation.js`);
}

const COUNTER_FIELDS = ['likeCount', 'downloadCount', 'commentCount'];

function adjustLobbyCounter(lobbyId, field, delta) {
	if (!lobbyId || !field) {
		return;
	}

	try {
		const lobby = $app.findRecordById('lobbies', lobbyId);
		const current = Number(lobby.get(field)) || 0;
		lobby.set(field, Math.max(0, current + delta));
		$app.save(lobby);
	} catch (error) {
		console.warn('[match_social] failed to update', field, String(error?.message || error));
	}
}

function adjustReplayCounter(replayId, field, delta) {
	if (!replayId || !field) {
		return;
	}

	try {
		const replay = $app.findRecordById('replays', replayId);
		const current = Number(replay.get(field)) || 0;
		replay.set(field, Math.max(0, current + delta));
		$app.save(replay);
	} catch (error) {
		console.warn('[match_social] failed to update replay', field, String(error?.message || error));
	}
}

function restoreCounterFields(e) {
	try {
		if (!e.hasSuperuserAuth()) {
			const original = e.record.original();
			for (const field of COUNTER_FIELDS) {
				e.record.set(field, original.get(field));
			}
		}
	} catch (error) {
		console.warn('[match_social] restoreCounterFields', String(error?.message || error));
	}

	e.next();
}

function adjustLobbyLikeCount(lobbyId, delta) {
	if (!lobbyId || !delta) {
		return;
	}

	try {
		const lobby = $app.findRecordById('lobbies', lobbyId);
		const current = Number(lobby.get('likeCount')) || 0;
		lobby.set('likeCount', current + delta);
		$app.save(lobby);
	} catch (error) {
		console.warn('[match_social] failed to update likeCount', String(error?.message || error));
	}
}

function onLikeCreate(e) {
	const value = Number(e.record.get('value'));
	e.record.set('value', value === -1 ? -1 : 1);
}

function onLikeUpdate(e) {
	const original = e.record.original();
	e.record.set('lobby', original.get('lobby'));
	e.record.set('user', original.get('user'));
	const lobbyId = recordId(e.record.get('lobby'));
	const value = Number(e.record.get('value'));
	if (value !== 1 && value !== -1) {
		throw new BadRequestError('Vote must be 1 or -1');
	}

	e.record.set('value', value);
	const oldValue = voteValue(original);
	e.next();
	const delta = value - oldValue;
	if (delta) {
		adjustLobbyLikeCount(lobbyId, delta);
		reputation().syncReplayVote(e.record, value);
	}
}

function onLikeCreated(e) {
	adjustLobbyLikeCount(e.record.get('lobby'), voteValue(e.record));
	reputation().syncReplayVote(e.record, voteValue(e.record));
}

function onLikeDeleted(e) {
	adjustLobbyLikeCount(e.record.get('lobby'), -voteValue(e.record));
	reputation().syncReplayVote(e.record, 0);
}

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
		console.warn('[match_social] steam query', String(error?.message || error));
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
		console.warn('[match_social] find users by steam', String(error?.message || error));
		return [];
	}
}

function findPriorCommenterUserIds(lobbyId, excludeCommentId) {
	try {
		const rows = arrayOf(new DynamicModel({ id: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT user AS id FROM lobby_comments
				 WHERE lobby = {:lobby}
				 AND ({:exclude} = '' OR id != {:exclude})
				 AND user IS NOT NULL AND user != ''`
			)
			.bind({ lobby: lobbyId, exclude: excludeCommentId || '' })
			.all(rows);
		return rows.map((row) => String(row.id)).filter(Boolean);
	} catch (error) {
		console.warn('[match_social] prior commenters', String(error?.message || error));
		return [];
	}
}

function findPriorReplayCommenterUserIds(replayId, excludeCommentId) {
	try {
		const rows = arrayOf(new DynamicModel({ id: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT user AS id FROM replay_comments
				 WHERE replay = {:replay}
				 AND ({:exclude} = '' OR id != {:exclude})
				 AND user IS NOT NULL AND user != ''`
			)
			.bind({ replay: replayId, exclude: excludeCommentId || '' })
			.all(rows);
		return rows.map((row) => String(row.id)).filter(Boolean);
	} catch (error) {
		console.warn('[match_social] prior replay commenters', String(error?.message || error));
		return [];
	}
}

function collectReplaySteamIds(replayId) {
	const found = Object.create(null);
	try {
		const rows = arrayOf(new DynamicModel({ steamId: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT CAST(json_extract(p.value, '$.steamId') AS TEXT) AS steamId
				 FROM json_each((
					 SELECT CASE
						 WHEN json_valid(players) AND json_type(players) = 'array' THEN players
						 ELSE '[]'
					 END
					 FROM replays WHERE id = {:replay}
				 )) AS p
				 WHERE json_extract(p.value, '$.steamId') IS NOT NULL
					 AND json_extract(p.value, '$.steamId') != ''`
			)
			.bind({ replay: replayId })
			.all(rows);
		for (const row of rows) addSteamId(found, row.steamId);
	} catch (error) {
		console.warn('[match_social] replay steam query', String(error?.message || error));
	}
	return Object.keys(found);
}

function replayUploaderId(replayId) {
	const id = recordId(replayId);
	if (!id) return '';
	try {
		return recordId($app.findRecordById('replays', id).get('createdBy'));
	} catch {
		return '';
	}
}

function uniqueUserIds(ids, excludeId) {
	const seen = Object.create(null);
	const out = [];
	for (const id of ids) {
		if (!id || id === excludeId || seen[id]) continue;
		seen[id] = true;
		out.push(id);
	}
	return out;
}

function commenterName(userId) {
	try {
		const user = $app.findRecordById('users', userId);
		return String(user.get('name') || '').trim() || 'Someone';
	} catch {
		return 'Someone';
	}
}

function commentSnippet(text) {
	const plain = String(text || '')
		.replace(/@\[([^\]]+)\]\(mention:[a-z0-9]{15}(?::\d+)?\)/g, '@$1')
		.replace(/\s+/g, ' ')
		.trim();
	if (!plain) return '';
	if (plain.length <= 280) return plain;
	return plain.slice(0, 277) + '...';
}

function parseMentionUserIds(text) {
	const ids = [];
	const seen = Object.create(null);
	const re = /@\[([^\]]+)\]\(mention:([a-z0-9]{15})(?::\d+)?\)/g;
	let match;
	while ((match = re.exec(String(text || '')))) {
		const id = match[2];
		if (!id || seen[id]) continue;
		seen[id] = true;
		ids.push(id);
		if (ids.length >= 10) break;
	}
	return ids;
}

function existingUserIds(ids) {
	const out = [];
	for (const id of ids) {
		try {
			$app.findRecordById('users', id);
			out.push(id);
		} catch {
			// missing or deleted account
		}
	}
	return out;
}

function saveCommentNotification(payload) {
	if (!payload.userIds.length) return;
	const record = new Record($app.findCollectionByNameOrId('notifications'));
	record.set('title', payload.title);
	record.set('body', payload.body);
	record.set('targetAll', false);
	record.set('recipients', payload.userIds);
	record.set('lobby', payload.lobbyId);
	if (payload.commentId) {
		record.set('comment', payload.commentId);
	}
	record.set('createdBy', payload.commenterId);
	$app.save(record);
}

function saveReplayCommentNotification(payload) {
	if (!payload.userIds.length) return;
	const record = new Record($app.findCollectionByNameOrId('notifications'));
	record.set('title', payload.title);
	record.set('body', payload.body);
	record.set('targetAll', false);
	record.set('recipients', payload.userIds);
	record.set('replay', payload.replayId);
	if (payload.commentId) {
		record.set('replayComment', payload.commentId);
	}
	record.set('createdBy', payload.commenterId);
	$app.save(record);
}

function notifyMatchPlayers(comment) {
	try {
		const lobbyId = recordId(comment.get('lobby'));
		const commenterId = recordId(comment.get('user'));
		const commentId = recordId(comment.id);
		if (!lobbyId || !commenterId) {
			console.warn('[match_social] notify skip: missing lobby or user');
			return;
		}
		const steamIds = collectLobbySteamIds(lobbyId);
		const mentionedIds = uniqueUserIds(
			existingUserIds(parseMentionUserIds(comment.get('text'))),
			commenterId
		);
		const mentioned = Object.create(null);
		for (const id of mentionedIds) mentioned[id] = true;
		const generalIds = uniqueUserIds(
			[...findUserIdsBySteamIds(steamIds), ...findPriorCommenterUserIds(lobbyId, commentId)],
			commenterId
		).filter((id) => !mentioned[id]);
		if (!mentionedIds.length && !generalIds.length) {
			console.warn('[match_social] notify skip: no recipients', lobbyId, 'steam', steamIds.length);
			return;
		}
		const isReply = Boolean(parentId(comment));
		const name = commenterName(commenterId);
		const body =
			commentSnippet(comment.get('text')) || (isReply ? 'New reply' : 'New comment');
		const shared = { body, lobbyId, commentId, commenterId };
		if (mentionedIds.length) {
			saveCommentNotification({
				...shared,
				title: `${name} mentioned you on a match`,
				userIds: mentionedIds
			});
		}
		if (generalIds.length) {
			saveCommentNotification({
				...shared,
				title: isReply ? `${name} replied on a match` : `${name} commented on a match`,
				userIds: generalIds
			});
		}
		console.log(
			'[match_social] notify',
			lobbyId,
			'recipients',
			generalIds.length,
			'mentions',
			mentionedIds.length
		);
	} catch (error) {
		console.warn('[match_social] notifyMatchPlayers', String(error?.message || error));
	}
}

function notifyReplayPlayers(comment) {
	try {
		const replayId = recordId(comment.get('replay'));
		const commenterId = recordId(comment.get('user'));
		const commentId = recordId(comment.id);
		if (!replayId || !commenterId) {
			console.warn('[match_social] notify replay skip: missing replay or user');
			return;
		}
		const steamIds = collectReplaySteamIds(replayId);
		const uploaderId = replayUploaderId(replayId);
		const mentionedIds = uniqueUserIds(
			existingUserIds(parseMentionUserIds(comment.get('text'))),
			commenterId
		);
		const mentioned = Object.create(null);
		for (const id of mentionedIds) mentioned[id] = true;
		const generalIds = uniqueUserIds(
			[
				uploaderId,
				...findUserIdsBySteamIds(steamIds),
				...findPriorReplayCommenterUserIds(replayId, commentId)
			],
			commenterId
		).filter((id) => !mentioned[id]);
		if (!mentionedIds.length && !generalIds.length) {
			console.warn(
				'[match_social] notify replay skip: no recipients',
				replayId,
				'steam',
				steamIds.length
			);
			return;
		}
		const isReply = Boolean(parentId(comment));
		const name = commenterName(commenterId);
		const body =
			commentSnippet(comment.get('text')) || (isReply ? 'New reply' : 'New comment');
		const shared = { body, replayId, commentId, commenterId };
		if (mentionedIds.length) {
			saveReplayCommentNotification({
				...shared,
				title: `${name} mentioned you on a replay`,
				userIds: mentionedIds
			});
		}
		if (generalIds.length) {
			saveReplayCommentNotification({
				...shared,
				title: isReply ? `${name} replied on a replay` : `${name} commented on a replay`,
				userIds: generalIds
			});
		}
		console.log(
			'[match_social] notify replay',
			replayId,
			'recipients',
			generalIds.length,
			'mentions',
			mentionedIds.length
		);
	} catch (error) {
		console.warn('[match_social] notifyReplayPlayers', String(error?.message || error));
	}
}

const MAX_COMMENT_DEPTH = 8;
const COMMENT_PROTECTED_FIELDS = ['likeCount', 'parent', 'lobby', 'user'];
const REPLAY_COMMENT_PROTECTED_FIELDS = ['likeCount', 'parent', 'replay', 'user'];

function parentId(record) {
	const value = record.get('parent');
	if (!value) return '';
	if (typeof value === 'object' && value.id) return String(value.id);
	return String(value);
}

function commentDepth(commentId, collection) {
	let depth = 0;
	let current = commentId;
	const seen = Object.create(null);
	while (current && depth <= MAX_COMMENT_DEPTH) {
		if (seen[current]) break;
		seen[current] = true;
		let record;
		try {
			record = $app.findRecordById(collection, current);
		} catch {
			break;
		}
		current = parentId(record);
		if (current) depth += 1;
	}
	return depth;
}

function onCommentCreate(e) {
	if (!e.record) return;
	if (!e.hasSuperuserAuth()) {
		e.record.set('likeCount', 0);
		e.record.set('deleted', false);
		e.record.set('deletedAt', '');
		e.record.set('deletedBy', '');
		e.record.set('deletedNote', '');
	}
	const parent = parentId(e.record);
	if (!parent) return;
	let parentRecord;
	try {
		parentRecord = $app.findRecordById('lobby_comments', parent);
	} catch {
		throw new BadRequestError('Parent comment not found');
	}
	if (parentRecord.get('deleted')) {
		throw new BadRequestError('Cannot reply to a deleted comment');
	}
	if (String(parentRecord.get('lobby')) !== String(e.record.get('lobby'))) {
		throw new BadRequestError('Reply must be on the same match');
	}
	if (commentDepth(parent, 'lobby_comments') + 1 > MAX_COMMENT_DEPTH) {
		throw new BadRequestError('Reply is nested too deep');
	}
}

function onReplayCommentCreate(e) {
	if (!e.record) return;
	if (!e.hasSuperuserAuth()) {
		e.record.set('likeCount', 0);
		e.record.set('deleted', false);
		e.record.set('deletedAt', '');
		e.record.set('deletedBy', '');
		e.record.set('deletedNote', '');
	}
	const parent = parentId(e.record);
	if (!parent) return;
	let parentRecord;
	try {
		parentRecord = $app.findRecordById('replay_comments', parent);
	} catch {
		throw new BadRequestError('Parent comment not found');
	}
	if (parentRecord.get('deleted')) {
		throw new BadRequestError('Cannot reply to a deleted comment');
	}
	if (String(parentRecord.get('replay')) !== String(e.record.get('replay'))) {
		throw new BadRequestError('Reply must be on the same replay');
	}
	if (commentDepth(parent, 'replay_comments') + 1 > MAX_COMMENT_DEPTH) {
		throw new BadRequestError('Reply is nested too deep');
	}
}

function restoreCommentProtectedFields(e) {
	if (e.hasSuperuserAuth()) {
		e.next();
		return;
	}

	const original = e.record.original();
	for (const field of COMMENT_PROTECTED_FIELDS) {
		e.record.set(field, original.get(field));
	}

	applyCommentSoftDelete(e, original);
	const becomingDeleted = !Boolean(original.get('deleted')) && Boolean(e.record.get('deleted'));
	const lobbyId = e.record.get('lobby');
	e.next();
	if (becomingDeleted) {
		adjustLobbyCounter(lobbyId, 'commentCount', -1);
		reputation().revokeCommentCreated(e.record);
	}
}

function restoreReplayCommentProtectedFields(e) {
	if (e.hasSuperuserAuth()) {
		e.next();
		return;
	}

	const original = e.record.original();
	for (const field of REPLAY_COMMENT_PROTECTED_FIELDS) {
		e.record.set(field, original.get(field));
	}

	applyCommentSoftDelete(e, original);
	const becomingDeleted = !Boolean(original.get('deleted')) && Boolean(e.record.get('deleted'));
	const replayId = e.record.get('replay');
	e.next();
	if (becomingDeleted) {
		adjustReplayCounter(replayId, 'commentCount', -1);
		reputation().revokeCommentCreated(e.record);
	}
}

function onCommentCreated(e) {
	adjustLobbyCounter(e.record.get('lobby'), 'commentCount', 1);
	notifyMatchPlayers(e.record);
	reputation().awardCommentCreated(e.record);
}

function onReplayCommentCreated(e) {
	adjustReplayCounter(e.record.get('replay'), 'commentCount', 1);
	notifyReplayPlayers(e.record);
	reputation().awardCommentCreated(e.record);
}

function onCommentDeleted(e) {
	if (e.record.get('deleted')) {
		return;
	}

	adjustLobbyCounter(e.record.get('lobby'), 'commentCount', -1);
	reputation().revokeCommentCreated(e.record);
}

function onReplayCommentDeleted(e) {
	if (e.record.get('deleted')) {
		return;
	}

	adjustReplayCounter(e.record.get('replay'), 'commentCount', -1);
	reputation().revokeCommentCreated(e.record);
}

function isStaffAuth(auth) {
	if (!auth) {
		return false;
	}

	const role = String(auth.get('role') || '');
	return role === 'admin' || role === 'moderator';
}

function applyCommentSoftDelete(e, original) {
	const alreadyDeleted = Boolean(original.get('deleted'));
	const nextDeleted = Boolean(e.record.get('deleted'));
	if (alreadyDeleted) {
		e.record.set('deleted', true);
		e.record.set('deletedAt', original.get('deletedAt'));
		e.record.set('deletedBy', original.get('deletedBy'));
		e.record.set('deletedNote', original.get('deletedNote'));
		e.record.set('text', original.get('text'));
		return;
	}

	if (!nextDeleted) {
		e.record.set('deleted', false);
		e.record.set('deletedAt', original.get('deletedAt'));
		e.record.set('deletedBy', original.get('deletedBy'));
		e.record.set('deletedNote', original.get('deletedNote'));
		return;
	}

	const auth = e.auth;
	if (!auth?.id) {
		throw new BadRequestError('Log in to do that.');
	}

	const note = String(e.record.get('deletedNote') || '').trim();
	if (isStaffAuth(auth)) {
		if (!note) {
			throw new BadRequestError('Enter a reason.');
		}

		e.record.set('deletedNote', note.slice(0, 500));
	} else {
		e.record.set('deletedNote', '');
	}

	e.record.set('deleted', true);
	e.record.set('deletedBy', auth.id);
	e.record.set('deletedAt', new Date().toISOString());
}

function voteValue(record) {
	const raw = Number(record.get('value'));
	if (raw === -1) {
		return -1;
	}

	return 1;
}

function requireLiveComment(commentId, collection) {
	if (!commentId) {
		throw new BadRequestError('Comment is required');
	}

	let comment;
	try {
		comment = $app.findRecordById(collection || 'lobby_comments', commentId);
	} catch {
		throw new BadRequestError('Comment not found');
	}

	if (comment.get('deleted')) {
		throw new BadRequestError('Cannot vote on a deleted comment');
	}

	return comment;
}

function onCommentLikeCreate(e) {
	requireLiveComment(recordId(e.record.get('comment')), 'lobby_comments');
	const value = Number(e.record.get('value'));
	e.record.set('value', value === -1 ? -1 : 1);
}

function onCommentLikeUpdate(e) {
	const original = e.record.original();
	e.record.set('comment', original.get('comment'));
	e.record.set('user', original.get('user'));
	const commentId = recordId(e.record.get('comment'));
	requireLiveComment(commentId, 'lobby_comments');
	const value = Number(e.record.get('value'));
	if (value !== 1 && value !== -1) {
		throw new BadRequestError('Vote must be 1 or -1');
	}

	e.record.set('value', value);
	const oldValue = voteValue(original);
	e.next();
	const delta = value - oldValue;
	if (delta) {
		adjustCommentLikeCount(commentId, delta, 'lobby_comments');
		reputation().syncCommentVote(e.record, value);
	}
}

function onReplayCommentLikeCreate(e) {
	requireLiveComment(recordId(e.record.get('comment')), 'replay_comments');
	const value = Number(e.record.get('value'));
	e.record.set('value', value === -1 ? -1 : 1);
}

function onReplayCommentLikeUpdate(e) {
	const original = e.record.original();
	e.record.set('comment', original.get('comment'));
	e.record.set('user', original.get('user'));
	const commentId = recordId(e.record.get('comment'));
	requireLiveComment(commentId, 'replay_comments');
	const value = Number(e.record.get('value'));
	if (value !== 1 && value !== -1) {
		throw new BadRequestError('Vote must be 1 or -1');
	}

	e.record.set('value', value);
	const oldValue = voteValue(original);
	e.next();
	const delta = value - oldValue;
	if (delta) {
		adjustCommentLikeCount(commentId, delta, 'replay_comments');
		reputation().syncCommentVote(e.record, value);
	}
}

function adjustCommentLikeCount(commentId, delta, collection) {
	if (!commentId) {
		return;
	}
	try {
		const comment = $app.findRecordById(collection || 'lobby_comments', commentId);
		const current = Number(comment.get('likeCount')) || 0;
		comment.set('likeCount', current + delta);
		$app.save(comment);
	} catch (error) {
		console.warn('[match_social] failed to update comment likeCount', String(error?.message || error));
	}
}

function onCommentLikeCreated(e) {
	adjustCommentLikeCount(e.record.get('comment'), voteValue(e.record), 'lobby_comments');
	reputation().syncCommentVote(e.record, voteValue(e.record));
}

function onCommentLikeDeleted(e) {
	adjustCommentLikeCount(e.record.get('comment'), -voteValue(e.record), 'lobby_comments');
	reputation().syncCommentVote(e.record, 0);
}

function onReplayCommentLikeCreated(e) {
	adjustCommentLikeCount(e.record.get('comment'), voteValue(e.record), 'replay_comments');
	reputation().syncCommentVote(e.record, voteValue(e.record));
}

function onReplayCommentLikeDeleted(e) {
	adjustCommentLikeCount(e.record.get('comment'), -voteValue(e.record), 'replay_comments');
	reputation().syncCommentVote(e.record, 0);
}

function handleRecordDownload(e) {
	const auth = e.auth;

	if (!auth?.id) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const lobbyId = e.request.pathValue('id');

	if (!lobbyId) {
		return e.json(400, { message: 'lobby id required' });
	}

	let lobby;

	try {
		lobby = $app.findRecordById('lobbies', lobbyId);
	} catch {
		return e.json(404, { message: 'Match not found' });
	}

	try {
		$app.findFirstRecordByFilter(
			'lobby_downloads',
			'lobby = {:lobby} && user = {:user}',
			{ lobby: lobbyId, user: auth.id }
		);

		return e.json(200, { downloadCount: Number(lobby.get('downloadCount')) || 0 });
	} catch {
		// first download for this user
	}

	let downloadRecord;
	try {
		const collection = $app.findCollectionByNameOrId('lobby_downloads');
		downloadRecord = new Record(collection);
		downloadRecord.set('lobby', lobbyId);
		downloadRecord.set('user', auth.id);
		$app.save(downloadRecord);
	} catch (error) {
		try {
			lobby = $app.findRecordById('lobbies', lobbyId);
			return e.json(200, { downloadCount: Number(lobby.get('downloadCount')) || 0 });
		} catch {
			return e.json(400, { message: String(error?.message || error) });
		}
	}

	adjustLobbyCounter(lobbyId, 'downloadCount', 1);
	reputation().awardReplayDownload({
		uploaderId: lobby.get('user'),
		downloaderId: auth.id,
		sourceId: downloadRecord.id
	});

	try {
		lobby = $app.findRecordById('lobbies', lobbyId);
	} catch {
		return e.json(200, { downloadCount: 1 });
	}

	return e.json(200, { downloadCount: Number(lobby.get('downloadCount')) || 1 });
}

function adjustReplayLikeCount(replayId, delta) {
	if (!replayId || !delta) {
		return;
	}

	try {
		const replay = $app.findRecordById('replays', replayId);
		const current = Number(replay.get('likeCount')) || 0;
		replay.set('likeCount', current + delta);
		$app.save(replay);
	} catch (error) {
		console.warn('[match_social] failed to update replay likeCount', String(error?.message || error));
	}
}

function onReplayLikeCreate(e) {
	const value = Number(e.record.get('value'));
	e.record.set('value', value === -1 ? -1 : 1);
}

function onReplayLikeUpdate(e) {
	const original = e.record.original();
	e.record.set('replay', original.get('replay'));
	e.record.set('user', original.get('user'));
	const replayId = recordId(e.record.get('replay'));
	const value = Number(e.record.get('value'));
	if (value !== 1 && value !== -1) {
		throw new BadRequestError('Vote must be 1 or -1');
	}

	e.record.set('value', value);
	const oldValue = voteValue(original);
	e.next();
	const delta = value - oldValue;
	if (delta) {
		adjustReplayLikeCount(replayId, delta);
		reputation().syncMemberReplayVote(e.record, value);
	}
}

function onReplayLikeCreated(e) {
	adjustReplayLikeCount(e.record.get('replay'), voteValue(e.record));
	reputation().syncMemberReplayVote(e.record, voteValue(e.record));
}

function onReplayLikeDeleted(e) {
	adjustReplayLikeCount(e.record.get('replay'), -voteValue(e.record));
	reputation().syncMemberReplayVote(e.record, 0);
}

module.exports = {
	restoreCounterFields,
	restoreCommentProtectedFields,
	restoreReplayCommentProtectedFields,
	onLikeCreate,
	onLikeUpdate,
	onLikeCreated,
	onLikeDeleted,
	onReplayLikeCreate,
	onReplayLikeUpdate,
	onReplayLikeCreated,
	onReplayLikeDeleted,
	onCommentCreate,
	onCommentCreated,
	onCommentDeleted,
	onReplayCommentCreate,
	onReplayCommentCreated,
	onReplayCommentDeleted,
	onCommentLikeCreate,
	onCommentLikeUpdate,
	onCommentLikeCreated,
	onCommentLikeDeleted,
	onReplayCommentLikeCreate,
	onReplayCommentLikeUpdate,
	onReplayCommentLikeCreated,
	onReplayCommentLikeDeleted,
	handleRecordDownload
};
