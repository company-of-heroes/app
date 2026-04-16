import type { HTMLAttributes } from 'svelte/elements';
import type { Snippet } from 'svelte';
import H from './h.svelte';

export type HeadingProps = {
	level: 1 | 2 | 3 | 4 | 5 | 6 | '1' | '2' | '3' | '4' | '5' | '6';
	children: Snippet;
} & HTMLAttributes<HTMLHeadingElement>;

export { H };
