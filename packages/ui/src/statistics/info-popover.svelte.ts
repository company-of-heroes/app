/** What a statistics row can describe: a squad (`sbps`), an upgrade or a doctrine. */
export type InfoEntry =
	| { kind: 'unit' | 'upgrade'; raceId: number; id: number; name: string }
	| { kind: 'doctrine'; raceId: number; doctrine: number; name: string };

type Shown = { entry: InfoEntry; anchor: HTMLElement };

/**
 * One popover shared by every row of a list, like the replay timeline: hovering opens it after a
 * short delay, clicking pins it (and is the only way in on touch). Only one list's popover is
 * open at a time: opening one closes the others.
 */
export class InfoPopover {
	static #open: InfoPopover | null = null;

	hovered = $state<Shown | null>(null);
	pinned = $state<Shown | null>(null);
	shown = $derived(this.pinned ?? this.hovered);
	#timer: ReturnType<typeof setTimeout> | undefined;

	hover(entry: InfoEntry, anchor: HTMLElement) {
		clearTimeout(this.#timer);
		// Moving between rows swaps the popover at once; the first hover waits a moment.
		this.#timer = setTimeout(
			() => {
				this.#claim();
				this.hovered = { entry, anchor };
			},
			this.hovered ? 0 : 150
		);
	}

	leave() {
		clearTimeout(this.#timer);
		this.hovered = null;
	}

	toggle(entry: InfoEntry, anchor: HTMLElement) {
		this.#claim();
		this.pinned = this.pinned?.anchor === anchor ? null : { entry, anchor };
	}

	/** Closes another list's popover before this one opens. */
	#claim() {
		if (InfoPopover.#open !== this) {
			InfoPopover.#open?.close();
			InfoPopover.#open = this;
		}
	}

	close() {
		this.leave();
		this.pinned = null;
	}

	/** Spread on a link row: hovering shows the popover, a click follows the link. */
	hoverTrigger(entry: InfoEntry) {
		return {
			onpointerenter: (event: PointerEvent) => {
				if (event.pointerType === 'mouse') {
					this.hover(entry, event.currentTarget as HTMLElement);
				}
			},
			onpointerleave: () => this.leave()
		};
	}

	/** Spread on a row's button. */
	trigger(entry: InfoEntry) {
		return {
			onpointerenter: (event: PointerEvent) => {
				if (event.pointerType === 'mouse') {
					this.hover(entry, event.currentTarget as HTMLElement);
				}
			},
			onpointerleave: () => this.leave(),
			onclick: (event: MouseEvent) => this.toggle(entry, event.currentTarget as HTMLElement)
		};
	}
}
