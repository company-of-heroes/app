<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { createProfile, type Profile } from '.';

	type Props = {
		profile: Profile;
	} & HTMLAttributes<HTMLDivElement>;

	let { profile, children, ...restProps }: Props = $props();
	createProfile(profile);
</script>

<div {...restProps}>
	{@render children?.()}
</div>
