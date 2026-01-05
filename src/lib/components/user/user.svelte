<script lang="ts">
	import type { UsersResponse } from '$core/pocketbase/types';
	import type { Snippet } from 'svelte';
	import { createUser } from '.';

	type Props = {
		user: UsersResponse<Record<string, any>, string[]>;
		children: Snippet;
	};

	let { user, children }: Props = $props();
	createUser(user);
</script>

{@render children()}
