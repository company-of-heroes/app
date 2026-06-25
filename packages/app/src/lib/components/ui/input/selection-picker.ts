/** Portaled selection overlay — used so dialogs can ignore outside dismiss / focus trap. */
export const SELECTION_PICKER_SELECTOR = '[data-selection-picker]';

export function isSelectionPickerTarget(target: EventTarget | null): boolean {
	return target instanceof Element && Boolean(target.closest(SELECTION_PICKER_SELECTOR));
}

type EscapeHandler = () => void;

let openCount = 0;
let escapeHandler: EscapeHandler | null = null;

export const selectionPicker = {
	get isOpen() {
		return openCount > 0;
	},
	mountEscapeHandler(handler: EscapeHandler) {
		escapeHandler = handler;
		openCount++;
		return () => {
			openCount = Math.max(0, openCount - 1);
			if (escapeHandler === handler) {
				escapeHandler = null;
			}
		};
	},
	handleParentEscape() {
		escapeHandler?.();
	}
};
