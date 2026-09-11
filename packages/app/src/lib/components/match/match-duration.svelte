<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from './context';
	import dayjs from '$lib/dayjs';

	type Props = {} & HTMLAttributes<HTMLSpanElement>;

	const match = useMatch();
	const { ...restProps }: Props = $props();

	const duration = $derived.by(() => {
		const result = match.result;
		if (result && 'startgametime' in result && 'completiontime' in result) {
			const start = result.startgametime;
			const end = result.completiontime;
			if (typeof start === 'number' && typeof end === 'number') {
				return dayjs.duration((end - start) * 1000);
			}
		}

		const seconds = match.durationSeconds;
		if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) {
			return dayjs.duration(seconds, 'seconds');
		}

		return null;
	});
</script>

{#if duration}
	<span {...restProps}>
		{#if duration.hours() > 0}
			{duration.hours()}h
		{/if}
		{duration.minutes()}m {duration.seconds()}s
	</span>
{/if}
