#!/usr/bin/env node
// Posts the root CHANGELOG.md section for a release tag to a Discord webhook.
//
// Used by `.github/workflows/discord-release.yml` after a GitHub Release is
// published. Pass `--dry-run` to print the payload without posting.
//
//   node scripts/discord-release.mjs --dry-run --tag v0.56.0
//
// Tag comes from `--tag`, else `RELEASE_TAG`. Webhook URL from
// `DISCORD_WEBHOOK_URL`. Optional `GITHUB_REPOSITORY` (owner/repo) is used to
// build release links; defaults to fknoobs/app.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_DESCRIPTION = 3900;
const DEFAULT_REPO = 'fknoobs/app';
const EMBED_COLOR = 0xc9a227;

const GROUPS = [
	{ keys: ['feat'], title: 'Features' },
	{ keys: ['fix'], title: 'Fixes' },
	{ keys: ['enhance', 'improvement'], title: 'Improvements' },
	{ keys: ['security'], title: 'Security' }
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const changelogPath = join(scriptDir, '..', 'CHANGELOG.md');

function argValue(name) {
	const prefix = `--${name}`;
	const eq = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
	if (eq) {
		return eq.slice(prefix.length + 1);
	}

	const index = process.argv.indexOf(prefix);
	if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
		return process.argv[index + 1];
	}

	return undefined;
}

function normalizeTag(raw) {
	const trimmed = (raw ?? '').trim();
	if (!trimmed) {
		throw new Error('Missing release tag. Pass --tag vX.Y.Z or set RELEASE_TAG.');
	}

	return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

function extractSection(changelog, tag) {
	const heading = `### ${tag}`;
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = changelog.match(new RegExp(`${escaped}\\r?\\n([\\s\\S]*?)(?=\\n### |$)`));
	if (!match) {
		throw new Error(`No CHANGELOG.md section found for ${tag}.`);
	}

	return match[1].trim();
}

function parseEntries(section) {
	const entries = [];
	for (const line of section.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		const prefixed = trimmed.match(/^- ([a-z]+);\s*(.+)$/i);
		if (prefixed) {
			entries.push({ kind: prefixed[1].toLowerCase(), text: prefixed[2].trim() });
			continue;
		}

		if (trimmed.startsWith('- ')) {
			entries.push({ kind: 'other', text: trimmed.slice(2).trim() });
		}
	}
	return entries;
}

function formatDescription(entries, downloadUrl, changelogUrl) {
	if (entries.length === 0) {
		return `See the [full changelog](${changelogUrl}).\n\n[Download](${downloadUrl})`;
	}

	const buckets = new Map();
	for (const group of GROUPS) {
		buckets.set(group.title, []);
	}
	buckets.set('Other', []);

	for (const entry of entries) {
		const group = GROUPS.find((item) => item.keys.includes(entry.kind));
		buckets.get(group?.title ?? 'Other').push(`- ${entry.text}`);
	}

	const parts = [];
	for (const [title, lines] of buckets) {
		if (!lines.length) {
			continue;
		}

		parts.push(`**${title}**\n${lines.join('\n')}`);
	}
	parts.push(`[Download](${downloadUrl})`);
	return truncateDescription(parts.join('\n\n'), changelogUrl);
}

function truncateDescription(text, changelogUrl) {
	if (text.length <= MAX_DESCRIPTION) {
		return text;
	}

	const suffix = `\n\n…and more. [Full changelog](${changelogUrl})`;
	const budget = MAX_DESCRIPTION - suffix.length;
	const cut = text.slice(0, Math.max(budget, 0));
	const lastNewline = cut.lastIndexOf('\n');
	return `${(lastNewline > 0 ? cut.slice(0, lastNewline) : cut).trimEnd()}${suffix}`;
}

function webhookUrl(url) {
	const parsed = new URL(url);
	parsed.searchParams.set('wait', 'true');
	return parsed.toString();
}

function buildPayload(tag, description, releaseUrl) {
	return {
		username: 'Company of Heroes Companion',
		embeds: [
			{
				title: `Company of Heroes Companion ${tag}`,
				url: releaseUrl,
				description,
				color: EMBED_COLOR
			}
		]
	};
}

async function postWebhook(url, payload) {
	const response = await fetch(webhookUrl(url), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Discord webhook failed (${response.status}): ${body}`);
	}
}

async function main() {
	const tag = normalizeTag(argValue('tag') ?? process.env.RELEASE_TAG);
	const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
	const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`;
	const downloadUrl = `https://github.com/${repo}/releases/latest`;
	const changelogUrl = `https://github.com/${repo}/blob/${tag}/CHANGELOG.md`;

	if (!existsSync(changelogPath)) {
		throw new Error(`CHANGELOG.md not found at ${changelogPath}`);
	}

	const changelog = readFileSync(changelogPath, 'utf8');
	const section = extractSection(changelog, tag);
	const description = formatDescription(parseEntries(section), downloadUrl, changelogUrl);
	const payload = buildPayload(tag, description, releaseUrl);

	if (DRY_RUN) {
		console.log(JSON.stringify(payload, null, 2));
		return;
	}

	const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
	if (!webhook) {
		throw new Error('DISCORD_WEBHOOK_URL is not set.');
	}

	await postWebhook(webhook, payload);
	console.log(`Posted Discord announcement for ${tag}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
