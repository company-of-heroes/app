import type { Snippet } from 'svelte';
import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';
import Input from './input.svelte';
import Checkbox from './checkbox.svelte';
import RadioGroup from './radio-group.svelte';
import Select from './select.svelte';
import Options from './options.svelte';
import Editor from './editor.svelte';
import Selection from './selection.svelte';
import FileSelection from './file-selection.svelte';
import Slider from './slider.svelte';
import Textarea from './textarea.svelte';

export type InputProps = {
	leading?: Snippet;
	trailing?: Snippet;
} & HTMLInputAttributes;
export type TextareaProps = {} & HTMLTextareaAttributes;

export {
	Input,
	Checkbox,
	RadioGroup,
	Select,
	Options,
	Editor,
	Selection,
	Slider,
	FileSelection,
	Textarea
};
