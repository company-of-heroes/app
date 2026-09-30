<script lang="ts">
	import { ProfileCustomizationForm } from '@company-of-heroes/ui/player';
	import { useHost } from '@company-of-heroes/ui/host';
	import { Button } from '$lib/components/ui/button';
	import { flushHeader, flushHeaderDescription } from '$lib/components/ui/variants';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const host = useHost();
	const steamId = $derived(host.api.profile.steamId());
</script>

<div class={flushHeader}>
	<h1 class="font-heading text-xl font-bold text-white">{t('Update profile')}</h1>
	{#if steamId}
		<p class={flushHeaderDescription}>
			<Button href={`/players/${steamId}`} variant="link" class="h-auto px-0">
				{t('View profile')}
			</Button>
		</p>
	{/if}
</div>

<ProfileCustomizationForm />
