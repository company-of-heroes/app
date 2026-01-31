import type { Editor } from 'svelte-tiptap';
import { Context } from 'runed';

export class EditorContext {
	_current = $state.raw<Editor>();
	_version = $state(0);

	get current() {
		this._version;
		return this._current;
	}

	set current(value: Editor | undefined) {
		this._current = value;
		this._version += 1;
	}
}

const editorContext = new Context<EditorContext>('<editor />');
export const createEditor = () => editorContext.set(new EditorContext());
export const useEditor = () => editorContext.get();
