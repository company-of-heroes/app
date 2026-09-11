import policyMarkdown from '../../../../../POLICY.md?raw';

export type InlineSpan =
	| { type: 'text'; text: string }
	| { type: 'strong'; text: string }
	| { type: 'link'; text: string; href: string };

export type PolicyBlock =
	| { type: 'p'; spans: InlineSpan[] }
	| { type: 'h2'; text: string }
	| { type: 'h3'; text: string }
	| { type: 'ul'; items: InlineSpan[][] };

export type PolicyDoc = {
	title: string;
	effectiveDate: string;
	blocks: PolicyBlock[];
};

const LINK_RE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g;

export function parseInline(input: string): InlineSpan[] {
	const spans: InlineSpan[] = [];
	let last = 0;
	for (const match of input.matchAll(LINK_RE)) {
		const index = match.index ?? 0;
		if (index > last) {
			spans.push({ type: 'text', text: input.slice(last, index) });
		}
		if (match[1] !== undefined) {
			spans.push({ type: 'strong', text: match[1] });
		} else {
			spans.push({ type: 'link', text: match[2] ?? '', href: match[3] ?? '' });
		}
		last = index + match[0].length;
	}
	if (last < input.length) {
		spans.push({ type: 'text', text: input.slice(last) });
	}
	return spans.length > 0 ? spans : [{ type: 'text', text: input }];
}

export function parsePolicyMarkdown(markdown: string): PolicyDoc {
	const lines = markdown.replaceAll('\r\n', '\n').trim().split('\n');
	let title = 'Privacy Policy';
	let effectiveDate = '';
	const blocks: PolicyBlock[] = [];
	let paragraph: string[] = [];
	let listItems: string[] | null = null;

	function flushParagraph() {
		const text = paragraph.join(' ').trim();
		paragraph = [];
		if (!text) return;
		const dateMatch = /^\*\*Effective date:\*\*\s*(.+)$/.exec(text);
		if (dateMatch && !effectiveDate) {
			effectiveDate = dateMatch[1] ?? '';
			return;
		}
		blocks.push({ type: 'p', spans: parseInline(text) });
	}

	function flushList() {
		if (!listItems?.length) {
			listItems = null;
			return;
		}
		blocks.push({ type: 'ul', items: listItems.map(parseInline) });
		listItems = null;
	}

	for (const raw of lines) {
		const line = raw.trimEnd();
		if (line.startsWith('# ')) {
			flushList();
			flushParagraph();
			title = line.slice(2).trim();
			continue;
		}
		if (line.startsWith('## ')) {
			flushList();
			flushParagraph();
			blocks.push({ type: 'h2', text: line.slice(3).trim() });
			continue;
		}
		if (line.startsWith('### ')) {
			flushList();
			flushParagraph();
			blocks.push({ type: 'h3', text: line.slice(4).trim() });
			continue;
		}
		if (line.startsWith('- ')) {
			flushParagraph();
			listItems ??= [];
			listItems.push(line.slice(2).trim());
			continue;
		}
		if (line.trim() === '') {
			flushList();
			flushParagraph();
			continue;
		}
		if (listItems) flushList();
		paragraph.push(line.trim());
	}
	flushList();
	flushParagraph();
	return { title, effectiveDate, blocks };
}

export const privacyPolicy = parsePolicyMarkdown(policyMarkdown);
