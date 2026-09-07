/** CSS properties mirrored onto a hidden div to measure textarea caret coordinates. */
const MIRROR_STYLE_KEYS = [
	'direction',
	'boxSizing',
	'width',
	'height',
	'overflowX',
	'overflowY',
	'borderTopWidth',
	'borderRightWidth',
	'borderBottomWidth',
	'borderLeftWidth',
	'borderStyle',
	'paddingTop',
	'paddingRight',
	'paddingBottom',
	'paddingLeft',
	'fontStyle',
	'fontVariant',
	'fontWeight',
	'fontStretch',
	'fontSize',
	'fontSizeAdjust',
	'lineHeight',
	'fontFamily',
	'textAlign',
	'textTransform',
	'textIndent',
	'textDecoration',
	'letterSpacing',
	'wordSpacing',
	'tabSize',
	'MozTabSize'
] as const;

/**
 * Returns a viewport DOMRect for the caret (or character) at `position` in a textarea,
 * using the mirror-div measurement technique.
 */
export function getTextareaCaretRect(textarea: HTMLTextAreaElement, position: number): DOMRect {
	const doc = textarea.ownerDocument;
	const win = doc.defaultView;
	if (!win) {
		return new DOMRect(0, 0, 0, 0);
	}

	const computed = win.getComputedStyle(textarea);
	const mirror = doc.createElement('div');
	const mirrorStyle = mirror.style as CSSStyleDeclaration & Record<(typeof MIRROR_STYLE_KEYS)[number], string>;

	mirrorStyle.whiteSpace = 'pre-wrap';
	mirrorStyle.wordWrap = 'break-word';
	mirrorStyle.position = 'absolute';
	mirrorStyle.visibility = 'hidden';
	mirrorStyle.top = '0px';
	mirrorStyle.left = '-9999px';

	for (const key of MIRROR_STYLE_KEYS) {
		mirrorStyle[key] = computed[key] as string;
	}

	// Match wrap behavior when the textarea scrolls vertically.
	if (Number.parseFloat(computed.height) > 0 && textarea.scrollHeight > textarea.clientHeight) {
		mirrorStyle.overflowY = 'scroll';
	} else {
		mirrorStyle.overflow = 'hidden';
	}

	const value = textarea.value;
	const clamped = Math.max(0, Math.min(position, value.length));
	mirror.textContent = value.slice(0, clamped);
	const marker = doc.createElement('span');
	// A trailing marker keeps empty lines measurable.
	marker.textContent = value.slice(clamped) || '.';
	mirror.appendChild(marker);
	doc.body.appendChild(mirror);

	const textareaRect = textarea.getBoundingClientRect();
	const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
	const borderLeft = Number.parseFloat(computed.borderLeftWidth) || 0;
	const top = textareaRect.top + borderTop + marker.offsetTop - textarea.scrollTop;
	const left = textareaRect.left + borderLeft + marker.offsetLeft - textarea.scrollLeft;
	const height = Number.parseFloat(computed.lineHeight) || marker.offsetHeight || 16;

	mirror.remove();

	return new DOMRect(left, top, 0, height);
}

export type TextareaCaretVirtualElement = {
	getBoundingClientRect: () => DOMRect;
	contextElement: HTMLTextAreaElement;
};

/** Floating UI–compatible virtual element anchored at a textarea character index. */
export function createTextareaCaretVirtualElement(
	textarea: HTMLTextAreaElement,
	position: number
): TextareaCaretVirtualElement {
	return {
		contextElement: textarea,
		getBoundingClientRect: () => getTextareaCaretRect(textarea, position)
	};
}
