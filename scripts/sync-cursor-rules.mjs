// Mirrors .cursor/rules and .cursor/skills into .claude so Claude Code picks them up.
// Runs as a Claude Code SessionStart hook; the .cursor files stay the single source of truth.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cursorRules = join(root, '.cursor/rules');
const cursorSkills = join(root, '.cursor/skills');
const claudeRules = join(root, '.claude/rules/cursor');
const claudeSkills = join(root, '.claude/skills');
const skillMarker = '.synced-from-cursor';

function splitGlobs(value) {
	const globs = [];
	let depth = 0;
	let current = '';

	for (const char of value.trim().replace(/^["']|["']$/g, '')) {
		if (char === '{') depth++;
		if (char === '}') depth--;

		if (char === ',' && depth === 0) {
			globs.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	if (current.trim()) globs.push(current.trim());

	return globs;
}

function convertRule(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

	if (!match) return source;

	const fields = Object.fromEntries(
		match[1]
			.split(/\r?\n/)
			.map((line) => line.match(/^(\w+):\s*(.*)$/))
			.filter(Boolean)
			.map(([, key, value]) => [key, value.trim()])
	);
	const body = source.slice(match[0].length).replace(/^\s+/, '');
	const alwaysApply = fields.alwaysApply === 'true';
	const globs = fields.globs ? splitGlobs(fields.globs) : [];
	const frontmatter = [];

	if (fields.description) frontmatter.push(`description: ${JSON.stringify(fields.description.replace(/^["']|["']$/g, ''))}`);

	// Cursor: alwaysApply wins over globs. Rules without globs are loaded always.
	if (!alwaysApply && globs.length) {
		frontmatter.push('paths:', ...globs.map((glob) => `  - ${JSON.stringify(glob)}`));
	}

	return frontmatter.length ? `---\n${frontmatter.join('\n')}\n---\n\n${body}` : body;
}

function syncRules() {
	rmSync(claudeRules, { recursive: true, force: true });

	if (!existsSync(cursorRules)) return 0;

	mkdirSync(claudeRules, { recursive: true });

	const files = readdirSync(cursorRules).filter((file) => /\.mdc?$/.test(file));

	for (const file of files) {
		const source = readFileSync(join(cursorRules, file), 'utf8');

		writeFileSync(join(claudeRules, file.replace(/\.mdc$/, '.md')), convertRule(source));
	}

	return files.length;
}

function syncSkills() {
	if (existsSync(claudeSkills)) {
		for (const entry of readdirSync(claudeSkills, { withFileTypes: true })) {
			const dir = join(claudeSkills, entry.name);

			if (entry.isDirectory() && existsSync(join(dir, skillMarker))) rmSync(dir, { recursive: true, force: true });
		}
	}

	if (!existsSync(cursorSkills)) return 0;

	const skills = readdirSync(cursorSkills, { withFileTypes: true }).filter((entry) => entry.isDirectory());

	for (const skill of skills) {
		const target = join(claudeSkills, skill.name);

		// Never overwrite a skill that was written for Claude directly.
		if (existsSync(target)) continue;

		cpSync(join(cursorSkills, skill.name), target, { recursive: true });
		writeFileSync(join(target, skillMarker), '');
	}

	return skills.length;
}

const rules = syncRules();
const skills = syncSkills();

console.log(`Synced ${rules} Cursor rules and ${skills} Cursor skills into .claude`);
