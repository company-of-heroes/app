#!/usr/bin/env node
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

const env = dotenv.config().parsed ?? {};
const adminEmail = env.PB_ADMIN_EMAIL;
const adminPassword = env.PB_ADMIN_PASSWORD;
const baseUrl = env.PB_URL ?? 'http://127.0.0.1:8090';
const dryRun = process.argv.includes('--dry-run');
const onlyNames = process.argv
	.filter((arg) => arg.startsWith('--name='))
	.map((arg) => arg.split('=')[1])
	.filter(Boolean);

if (!adminEmail || !adminPassword) {
	throw new Error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set in .env');
}

const client = new PocketBase(baseUrl);
await client.admins.authWithPassword(adminEmail, adminPassword);
console.log(`Authenticated against ${baseUrl} (dryRun=${dryRun})`);

const allUsers = await client.collection('users').getFullList(20000, {
	fields: 'id,name,created',
	filter: 'name != ""'
});

const duplicateGroups = buildDuplicateGroups(allUsers, onlyNames);
if (duplicateGroups.size === 0) {
	console.log('No duplicate user names found.');
	process.exit(0);
}

for (const [name, records] of duplicateGroups) {
	const sorted = records
		.slice()
		.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
	const keeper = sorted[0];
	const toMerge = sorted.slice(1);

	console.log(
		`Merging ${toMerge.length} duplicate account(s) for "${name}" into newest ${keeper.id}`
	);

	for (const oldUser of toMerge) {
		await mergeUser(oldUser, keeper);
	}
}

async function mergeUser(oldUser, targetUser) {
	const summary = {
		chat: await moveByField('chat', 'user', oldUser.id, targetUser.id),
		chatMessages: await moveByField('chat_messages', 'sender', oldUser.id, targetUser.id),
		chatRooms: await moveChatRooms(oldUser.id, targetUser.id),
		lobbies: await moveByField('lobbies', 'user', oldUser.id, targetUser.id),
		replays: await moveByField('replays', 'createdBy', oldUser.id, targetUser.id)
	};

	const dedup = await dedupeUserContent(targetUser.id);

	console.log(`  Reassigned from ${oldUser.id} -> ${targetUser.id}`, summary);
	console.log(`  Deduplicated content for ${targetUser.id}`, dedup);

	if (dryRun) {
		console.log(`  [dry-run] Would delete user ${oldUser.id}`);
		return;
	}

	await client.collection('users').delete(oldUser.id);
	console.log(`  Deleted duplicate user ${oldUser.id}`);
}

function buildDuplicateGroups(users, only) {
	const groups = new Map();

	for (const user of users) {
		const name = typeof user.name === 'string' ? user.name.trim() : '';
		if (!name) continue;
		if (only.length > 0 && !only.includes(name)) continue;
		const arr = groups.get(name) ?? [];
		arr.push(user);
		groups.set(name, arr);
	}

	for (const [name, records] of groups) {
		if (records.length < 2) {
			groups.delete(name);
		}
	}

	return groups;
}

async function moveByField(collection, field, fromId, toId) {
	const items = await client.collection(collection).getFullList(20000, {
		fields: 'id',
		filter: `${field} = "${fromId}"`
	});

	for (const item of items) {
		if (!dryRun) {
			await client.collection(collection).update(item.id, { [field]: toId });
		}
	}

	return items.length;
}

async function moveChatRooms(fromId, toId) {
	const rooms = await client.collection('chat_rooms').getFullList(20000, {
		fields: 'id,members',
		filter: `members ?= "${fromId}"`
	});

	for (const room of rooms) {
		const members = Array.from(
			new Set([...(room.members ?? []).filter((id) => id !== fromId), toId])
		);
		if (!dryRun) {
			await client.collection('chat_rooms').update(room.id, { members });
		}
	}

	return rooms.length;
}

// Deduplicate content that might collide after merging users.
async function dedupeUserContent(userId) {
	const replaysRemoved = await dedupeReplaysForUser(userId);
	const lobbiesRemoved = await dedupeLobbiesForUser(userId);
	return { replaysRemoved, lobbiesRemoved };
}

async function dedupeReplaysForUser(userId) {
	const replays = await client.collection('replays').getFullList(20000, {
		fields: 'id,title,filename,gameDate,createdAt',
		filter: `createdBy = "${userId}"`
	});

	const grouped = new Map();
	for (const replay of replays) {
		const key = `${replay.title || ''}||${replay.filename || ''}||${replay.gameDate || ''}`;
		const arr = grouped.get(key) ?? [];
		arr.push(replay);
		grouped.set(key, arr);
	}

	let removed = 0;
	for (const [, items] of grouped) {
		if (items.length < 2) continue;
		const sorted = items
			.slice()
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		const keep = sorted[0];
		const drop = sorted.slice(1);
		for (const dup of drop) {
			removed += 1;
			if (!dryRun) {
				await client.collection('replays').delete(dup.id);
			} else {
				console.log(`  [dry-run] Would delete duplicate replay ${dup.id} (keeping ${keep.id})`);
			}
		}
	}

	return removed;
}

async function dedupeLobbiesForUser(userId) {
	const lobbies = await client.collection('lobbies').getFullList(20000, {
		fields: 'id,sessionId,createdAt',
		filter: `user = "${userId}"`
	});

	const grouped = new Map();
	for (const lobby of lobbies) {
		const key = String(lobby.sessionId ?? '');
		const arr = grouped.get(key) ?? [];
		arr.push(lobby);
		grouped.set(key, arr);
	}

	let removed = 0;
	for (const [, items] of grouped) {
		if (items.length < 2) continue;
		const sorted = items
			.slice()
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		const keep = sorted[0];
		const drop = sorted.slice(1);
		for (const dup of drop) {
			removed += 1;
			if (!dryRun) {
				await client.collection('lobbies').delete(dup.id);
			} else {
				console.log(
					`  [dry-run] Would delete duplicate lobby ${dup.id} (session ${dup.sessionId}, keeping ${keep.id})`
				);
			}
		}
	}

	return removed;
}
