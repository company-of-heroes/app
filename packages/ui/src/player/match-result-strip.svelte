<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import MatchResultBadge from './match-result-badge.svelte';

	type Props = {
		matches: {
			id?: string | null;
			sessionId?: number;
			outcome: 0 | 1;
			raceId: number | null;
			matchtypeId: number | null;
		}[];
		class?: string;
	};

	let { matches, class: className }: Props = $props();
</script>

<!-- Recent form: one square per match, the row split evenly over the full width. -->
<div
	class={cn('grid w-full min-w-0 gap-1', className)}
	style:grid-template-columns="repeat({matches.length}, minmax(0, 1fr))"
>
	{#each matches as match (match.id || match.sessionId)}
		<MatchResultBadge {match} block />
	{/each}
</div>
