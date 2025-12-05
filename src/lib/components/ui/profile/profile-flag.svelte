<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { useProfile } from '.';
	import { upperCase } from 'lodash-es';
	import { cn } from '$lib/utils';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const profile = useProfile();
</script>

<img
	{...restProps}
	src="https://flagsapi.com/{upperCase(profile.relic.country)}/shiny/64.png"
	alt={profile.relic.country}
/>
