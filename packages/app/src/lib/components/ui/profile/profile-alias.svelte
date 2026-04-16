<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useProfile } from '.';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const profile = useProfile();
</script>

<span {...restProps}>{profile.relic.alias}</span>
