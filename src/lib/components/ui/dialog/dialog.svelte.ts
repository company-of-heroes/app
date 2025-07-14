import type { Snippet } from 'svelte';

class Dialog {
	open = $state(false);

	title = $state<string | Snippet>('');

	description = $state<string | Snippet>('');

	component = $state<Snippet | undefined>(undefined);

	close() {
		this.open = false;
		this.title = '';
		this.description = '';
		this.component = undefined;
	}
}

export const dialog = new Dialog();
