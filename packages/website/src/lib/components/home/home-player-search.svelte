<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import CardForm from '$lib/components/player/card-form.svelte';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<section class="border-secondary-800 border-b px-4 py-4">
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<div>
			<h2 class="font-heading text-lg font-bold text-white">{t('Find a player')}</h2>
			<p class="text-secondary-400 mt-0.5 text-sm">
				{t('Search for a player by Steam ID, profile ID, or in-game name.')}
			</p>
		</div>
		<Button href={href('/players')} variant="link" size="sm" class="px-0">{t('View all')}</Button>
	</div>
	<CardForm prominent />
</section>
