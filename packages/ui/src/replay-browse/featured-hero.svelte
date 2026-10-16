<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import ReplayCard from '../replay/replay-card.svelte';
	import ReplayCardSkeleton from '../replay/replay-card-skeleton.svelte';
	import type { CommunityMatch } from '../replay/types';

	type Props = {
		matches: CommunityMatch[];
		meSteamIds?: string[];
		loading?: boolean;
	};

	const { t } = useI18n();

	let { matches, meSteamIds = [], loading = false }: Props = $props();
</script>

<!-- The featured replays side by side; flush cells clip the outer right edge. -->
{#if loading || matches.length > 0}
	<div class="overflow-hidden" aria-busy={loading}>
		<div class="-mr-px grid sm:grid-cols-2 lg:grid-cols-3">
			{#if loading}
				{#each { length: 3 }, index (index)}
					<div class="border-secondary-800 min-w-0 border-r border-b">
						<ReplayCardSkeleton />
					</div>
				{/each}
			{:else}
				{#each matches.slice(0, 3) as match (match.id)}
					<div class="border-secondary-800 min-w-0 border-r border-b">
						<ReplayCard {match} {meSteamIds} label={t('Featured')} />
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
