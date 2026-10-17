<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import HandCoinsIcon from 'phosphor-svelte/lib/HandCoins';
	import { useI18n } from '$lib/i18n';
	import { PAYPAL_URL } from '$lib/site/urls';

	const { t } = useI18n();
</script>

<section id="donate" class="border-secondary-800 border-b">
	<div class="px-4 py-6 sm:px-6">
		<p class="text-primary mb-1 text-xs font-medium">{t('Donations')}</p>
		<h2 class="font-heading text-xl font-bold text-white">{t('Do I need donations?')}</h2>
		<p class="text-secondary-400 mt-1 max-w-2xl text-sm leading-relaxed">
			{t(
				'Running this site is not expensive, so there is no need for donations to keep this site running. However, if you want to support the project and the time we spent on it you can donate via PayPal.'
			)}
		</p>
		<div class="mt-4">
			<Button href={PAYPAL_URL} target="_blank" rel="noopener noreferrer" variant="secondary">
				<HandCoinsIcon size={18} weight="duotone" />
				{t('Donate via PayPal')}
			</Button>
		</div>
	</div>
</section>
