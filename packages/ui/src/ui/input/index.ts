import type { Snippet } from 'svelte';
import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';
import Input from './input.svelte';
import CompareInput from './compare-input.svelte';
import Checkbox from './checkbox.svelte';
import RadioGroup from './radio-group.svelte';
import Selection from './selection.svelte';
import Select from './select.svelte';
import Slider from './slider.svelte';
import Textarea from './textarea.svelte';
import FileDropzone from './file-dropzone.svelte';

export type InputProps = Omit<HTMLInputAttributes, 'size'> & {
	flush?: boolean;
	size?: 'sm' | 'md' | 'lg';
	decreaseLabel?: string;
	increaseLabel?: string;
	inputClasses?: string;
	leading?: Snippet;
	trailing?: Snippet;
};

export type TextareaProps = HTMLTextareaAttributes & {
	flush?: boolean;
};

export type { FileDropzoneProps } from './file-dropzone.svelte';
export type { CompareOperatorOption, CompareInputProps } from './compare-input.svelte';
export type { SelectProps, SelectItem } from './select.svelte';

export {
	Input,
	CompareInput,
	Checkbox,
	RadioGroup,
	Selection,
	Select,
	Slider,
	Textarea,
	FileDropzone
};
