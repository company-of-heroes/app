<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { UsersResponse } from '$core/pocketbase/types';
	import type { Snippet } from 'svelte';
	import { createUser } from '.';
	import { isEmpty } from 'lodash-es';

	type Props = {
		user: UsersResponse<Record<string, any>, string[]>;
	} & HTMLAttributes<HTMLDivElement>;

	let { user, children, ...restProps }: Props = $props();
	createUser(user);
</script>

{#if isEmpty(restProps)}
	{@render children?.()}
{:else}
	<div {...restProps}>
		{@render children?.()}
	</div>
{/if}
