import type { HTMLLabelAttributes } from 'svelte/elements';
import Label from './label.svelte';
import type { Snippet } from 'svelte';

export type LabelProps = {
	children: Snippet;
} & HTMLLabelAttributes;

export { Label };
