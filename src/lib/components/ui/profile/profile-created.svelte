<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useProfile } from '.';
	import dayjs from '$lib/dayjs';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const profile = useProfile();
</script>

{#if profile.steam.timecreated}
	<span {...restProps}>{dayjs.unix(profile.steam.timecreated).format('DD MMM, YYYY')}</span>
{/if}
