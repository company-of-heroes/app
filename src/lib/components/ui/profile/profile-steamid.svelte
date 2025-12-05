<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { useProfile } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAnchorAttributes;

	const { ...restProps }: Props = $props();
	const profile = useProfile();
</script>

<a
	{...restProps}
	href={`https://steamcommunity.com/profiles/${profile.steam.steamid}`}
	target="_blank"
	rel="noopener noreferrer"
	class={cn('hover:text-primary transition-colors', restProps.class)}
>
	{profile.steam.steamid}
</a>
