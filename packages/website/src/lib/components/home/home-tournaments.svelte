<script lang="ts">
	import type { Tournament } from '@company-of-heroes/api';
	import { Button } from '@company-of-heroes/ui/button';
	import { featuredTournaments, TournamentList } from '@company-of-heroes/ui/tournament';
	import { href, useI18n } from '$lib/i18n';

	type Props = {
		active: Tournament[];
		upcoming: Tournament[];
	};

	let { active, upcoming }: Props = $props();
	const { t } = useI18n();
	const tournaments = $derived(featuredTournaments(active, upcoming));
</script>

{#if tournaments.length > 0}
	<section>
		<div
			class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
		>
			<div>
				<h2 class="font-heading text-xl font-bold text-white">{t('Tournaments')}</h2>
				<p class="text-secondary-400 mt-1 text-sm">{t('Running now or open for sign-up.')}</p>
			</div>
			<Button href={href('/tournaments')} variant="link" size="sm" class="px-0">
				{t('View all')}
			</Button>
		</div>
		<!-- The list closes itself with its own bottom line. -->
		<TournamentList {tournaments} emptyMessage="" />
	</section>
{/if}
