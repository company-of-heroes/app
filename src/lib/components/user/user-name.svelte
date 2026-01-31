<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useUser } from '.';
	import { cn } from '$lib/utils';
	import { UsersRoleOptions } from '$core/pocketbase/types';

	type Props = HTMLAttributes<HTMLSpanElement>;

	let user = useUser();
	let { ...restProps }: Props = $props();
</script>

<span
	{...restProps}
	class={cn(user.role === UsersRoleOptions.admin && 'text-red-500', restProps.class)}
>
	{user.name}
</span>
