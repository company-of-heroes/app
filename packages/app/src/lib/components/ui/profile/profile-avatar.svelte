<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { useProfile } from '.';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const profile = useProfile();
</script>

<img
	src={profile.steam.avatarfull}
	alt={profile.relic.alias}
	class="border-success w-full rounded-lg border-3"
	{...restProps}
/>
