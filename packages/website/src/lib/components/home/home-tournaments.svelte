<script lang="ts">
	import type { Tournament } from '@company-of-heroes/api';
	import { Button } from '@company-of-heroes/ui/button';
	import { featuredTournaments, TournamentList } from '@company-of-heroes/ui/tournament';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
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
		<!-- Tinted so running and open tournaments stand out at the top of the home page. -->
		<div
			class="border-secondary-800 from-primary/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-linear-to-r to-transparent px-4 py-3"
		>
			<div class="flex items-center gap-3">
				<TrophyIcon size={24} weight="duotone" class="text-primary shrink-0" />
				<div>
					<h2 class="font-heading text-xl font-bold text-white">{t('Tournaments')}</h2>
					<p class="text-secondary-400 mt-1 text-sm">{t('Running now or open for sign-up.')}</p>
				</div>
			</div>
			<Button href={href('/tournaments')} variant="link" size="sm" class="px-0">
				{t('View all')}
			</Button>
		</div>
		<!-- The list closes itself with its own bottom line. -->
		<TournamentList {tournaments} emptyMessage="" />
	</section>
{/if}
