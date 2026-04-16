<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from './context';
	import dayjs from '$lib/dayjs';

	type Props = {} & HTMLAttributes<HTMLSpanElement>;

	const { result } = useMatch();
	const { ...restProps }: Props = $props();
</script>

{#if result && result.startgametime && result.completiontime}
	{@const diff = dayjs.duration((result.completiontime - result.startgametime) * 1000)}
	<span {...restProps}>
		{#if diff.hours() > 0}
			{diff.hours()}h
		{/if}
		{diff.minutes()}m {diff.seconds()}s
	</span>
{/if}
