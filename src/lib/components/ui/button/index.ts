import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import Button from './button.svelte';
import ButtonBack from './button-back.svelte';

export type ButtonProps = {
	variant?: 'primary' | 'secondary' | 'ghost' | 'link' | 'destructive';
	children: Snippet;
	loading?: boolean;
	href?: string;
} & HTMLButtonAttributes;

export { Button, ButtonBack };
