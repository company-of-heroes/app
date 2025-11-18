import Emittery from 'emittery';
import { watch } from 'runed';
import type { Component, Snippet } from 'svelte';

interface DialogEvents {
	close: never;
	open: never;
}

class Dialog extends Emittery<DialogEvents> {
	open = $state(false);

	title = $state<string | Snippet>('');

	description = $state<string | Snippet>('');

	component = $state<Component<any> | Snippet | undefined>(undefined);

	props = $state<any>();

	/**
	 * Type-safe method to set a component with its required props.
	 * For components without props, you can call it without the second argument.
	 * For components with required props, TypeScript will enforce passing them.
	 */
	setComponent<Props extends Record<string, any>>(
		component: Component<Props>,
		...args: Props extends Record<string, never> ? [] : [props: Props]
	) {
		this.component = component;
		this.props = args[0];
	}

	close() {
		this.open = false;
		this.title = '';
		this.description = '';
		this.component = undefined;
		this.props = undefined;

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
