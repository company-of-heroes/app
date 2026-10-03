<script lang="ts">
	import { page } from '$app/state';
	import {
		Card as ReplayCard,
		CardSkeleton as ReplayCardSkeleton,
		type CommunityMatch
	} from '@company-of-heroes/ui/replay';
	import { Button } from '@company-of-heroes/ui/button';
	import { meSteamIds } from '$lib/auth/user';
	import { replaysHref, recentMemberQuery, TOP_REPLAYS } from '$lib/replays';
	import { href, useI18n } from '$lib/i18n';

	type Props = {
		matches: CommunityMatch[];
		loading?: boolean;
		error?: string | null;
		/** Home page: a full section with a subtitle. */
		variant?: 'home' | 'strip';
	};

	let { matches, loading = false, error = null, variant = 'home' }: Props = $props();
	const { t } = useI18n();
	const user = $derived(page.data.user);
	const mySteamIds = $derived(meSteamIds(user));
	const viewAllHref = $derived(
		href(replaysHref({ ...recentMemberQuery(), sort: 'downloadCount', sortDir: 'desc' }, 'member'))
	);
</script>

{#if loading || matches.length > 0 || (variant === 'home' && error)}
	<section class="border-secondary-800 border-b">
		<div
			class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
		>
			<div class="min-w-0">
				<h2
					class="font-heading font-bold text-white {variant === 'home' ? 'text-xl' : 'text-base'}"
				>
					{t('Top replays')}
				</h2>
				{#if variant === 'home'}
					<p class="text-secondary-400 mt-1 text-sm">
						{t('The most downloaded replays of the week. Watch how the best games were won.')}
					</p>
				{/if}
			</div>
			<Button href={viewAllHref} variant="link" size="sm" class="px-0">{t('View all')}</Button>
		</div>
		{#if error}
			<p class="px-4 py-3 text-sm text-red-400">{t('Could not load top replays.')}</p>
		{:else}
			<div class="bg-secondary-800 grid gap-px sm:grid-cols-2 xl:grid-cols-4">
				{#if loading}
					{#each Array.from({ length: TOP_REPLAYS }, (_, i) => i) as i (i)}
						<ReplayCardSkeleton />
					{/each}
				{:else}
					{#each matches as match (match.id)}
						<ReplayCard {match} meSteamIds={mySteamIds} />
					{/each}
				{/if}
			</div>
		{/if}
	</section>
{/if}
