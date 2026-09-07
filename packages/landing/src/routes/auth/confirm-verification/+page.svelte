<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Verify email')} | {t('Company of Heroes 1 Stats')}</title>
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Verify email')}</h1>
	</div>
</div>

<div class="border-secondary-800 border-b px-4 py-6">
	{#if data.ok}
		<p class="text-success text-sm">{data.message}</p>
	{:else}
		<p class="text-destructive text-sm">{data.message}</p>
	{/if}
	<div class="mt-4 flex flex-wrap gap-3">
		<Button href={href('/account')} variant="secondary">{t('Account')}</Button>
		<Button href={href('/login')}>{t('Log in')}</Button>
	</div>
</div>
