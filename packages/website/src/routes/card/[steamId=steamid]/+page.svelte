<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { PlayerCard } from '@company-of-heroes/ui/supporter';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const card = $derived(data.card);
	const pngPath = $derived(`/api/v1/players/${card.steamId}/card.png`);
</script>

<Seo
	title={t('{alias} — Player card', { alias: card.alias })}
	description={t('Company of Heroes supporter card of {alias}: best ELO and rank per army.', {
		alias: card.alias
	})}
	type="profile"
	image={`${SITE_URL}${pngPath}`}
/>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:py-12">
	<PlayerCard {card} />
	<div class="flex flex-wrap items-center justify-end gap-2">
		<Button href={href(`/players/${card.steamId}`)} variant="secondary" size="sm">
			<UserIcon size={16} />
			{t('View profile')}
		</Button>
		<Button href={pngPath} download="coh1stats-card-{card.steamId}.png" size="sm">
			<DownloadSimpleIcon size={16} />
			{t('Download PNG')}
		</Button>
	</div>
</div>
