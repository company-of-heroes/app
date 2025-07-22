import Emittery from 'emittery';
import { watch } from 'runed';
import type { Snippet } from 'svelte';

interface DialogEvents {
	close: never;
	open: never;
}

class Dialog extends Emittery<DialogEvents> {
	open = $state(false);

	title = $state<string | Snippet>('');

	description = $state<string | Snippet>('');

	component = $state<Snippet | undefined>(undefined);

	close() {
		this.open = false;
		this.title = '';
		this.description = '';
		this.component = undefined;

		this.emit('close');
	}

	constructor() {
		super();

		$effect.root(() => {
			watch(
				() => this.open,
				(open) => {
					if (open) {
						this.emit('open');
					} else {
						this.emit('close');
					}
				}
			);
		});
	}
}

export const dialog = new Dialog();
