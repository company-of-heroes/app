<script lang="ts">
	import { ProfileCustomizationForm } from '@company-of-heroes/ui/player';
	import { useHost } from '@company-of-heroes/ui/host';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const host = useHost();
	const steamId = $derived(host.api.profile.steamId());
</script>

<svelte:head>
	<title>{t('Update profile')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Customize your public player profile bio, links, and background.')}
	/>
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Update profile')}</h1>
		{#if steamId}
			<p class="text-secondary-400 mt-1 text-sm">
				<a
					href={href(`/players/${steamId}`)}
					class={cn(interactive, 'text-primary hover:underline')}>{t('View profile')}</a
				>
			</p>
		{/if}
	</div>
</div>

<ProfileCustomizationForm />
