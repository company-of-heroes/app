<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import { href, useI18n } from '$lib/i18n';
	import { supporterDialog } from '$lib/supporter-dialog.svelte';

	const { t } = useI18n();
</script>

<!-- Last block before the footer, which draws the line above it. -->
<section id="support">
	<div class="px-4 py-6 sm:px-6">
		<p class="text-primary mb-1 text-xs font-medium">{t('Supporters')}</p>
		<h2 class="font-heading text-xl font-bold text-white">{t('Support coh1stats')}</h2>
		<p class="text-secondary-400 mt-1 max-w-2xl text-sm leading-relaxed">
			{t(
				'Running this site is not expensive, but building it takes a lot of time. If you want to support the project, become a supporter for €4.99 a month: you get a medal next to your name, supporter ribbons and a player card.'
			)}
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<Button onclick={() => (supporterDialog.open = true)}>
				<HeartIcon size={16} weight="fill" />
				{t('Become a supporter')}
			</Button>
			<Button variant="ghost" href={href('/supporters')}>{t('See the supporters')}</Button>
		</div>
	</div>
</section>
