import type { Dialog } from 'bits-ui';
import Emittery from 'emittery';
import { watch } from 'runed';
import type { Component, Snippet } from 'svelte';

interface ModalEvents {
	close: never;
	open: never;
}

export type ModalCreateOptions<Props extends Record<string, any> = {}> = {
	title?: string | Snippet;
	description?: string | Snippet;
	component: Component<Props>;
	props?: Props;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
	contentProps?: Dialog.ContentProps;
	hideCloseButton?: boolean;
};

class Modal extends Emittery<ModalEvents> {
	private _open = $state(false);

	private _title = $state<string | Snippet | undefined>(undefined);

	private _description = $state<string | Snippet | undefined>(undefined);

	private _component = $state<Component<any> | Snippet | undefined>(undefined);

	private _props = $state<Record<string, any> | undefined>(undefined);

	private _size = $state<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');

	private _contentProps = $state<Dialog.ContentProps | undefined>(undefined);

	private _hideCloseButton = $state<boolean>(false);

	get isOpen() {
		return this._open;
	}

	get title() {
		return this._title;
	}

	get description() {
		return this._description;
	}

	get component() {
		return this._component;
	}

	get props() {
		return this._props;
	}

	get size() {
		return this._size;
	}

	get contentProps() {
		return this._contentProps;
	}

	get hideCloseButton() {
		return this._hideCloseButton;
	}

	/**
	 * Type-safe method to set a component with its required props.
	 * For components without props, you can call it without the second argument.
	 * For components with required props, TypeScript will enforce passing them.
	 */
	setComponent<Props extends Record<string, any>>(
		component: Component<Props>,
		...args: Props extends Record<string, never> ? [] : [props: Props]
	) {
		this._component = component;
		this._props = args[0];
	}

	create(options: ModalCreateOptions) {
		this._title = options.title;
		this._description = options.description ?? undefined;
		this._component = options.component;
		this._props = options.props;
		this._size = options.size ?? 'md';
		this._contentProps = options.contentProps;
		this._hideCloseButton = options.hideCloseButton ?? false;
	}

	open() {
		this._open = true;
		this.emit('open');
	}

	close() {
		this._open = false;
		this._title = undefined;
		this._description = undefined;
		this._component = undefined;
		this._props = undefined;
		this._hideCloseButton = false;
		this._contentProps = undefined;

		this.emit('close');
	}

	constructor() {
		super();

		$effect.root(() => {
			watch(
				() => this._open,
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

export const modal = new Modal();
