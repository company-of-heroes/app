import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
import type { Component, Snippet } from 'svelte';
import Link from './link.svelte';
import Nav from './nav.svelte';

export type LinkProps = {
	children: Snippet;
	component?: Component;
	path?: string;
} & HTMLAnchorAttributes;

export type NavProps = {
	children: Snippet;
} & HTMLAttributes<HTMLElement>;

export { Nav as Root, Link };
