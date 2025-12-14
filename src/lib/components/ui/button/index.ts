import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import Button from './button.svelte';
import ButtonBack from './button-back.svelte';

export type ButtonProps = {
	variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
	children: Snippet;
	loading?: boolean;
} & HTMLButtonAttributes;

export { Button, ButtonBack };
