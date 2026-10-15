<script lang="ts">
	import { page } from '$app/state';
	import { resource } from 'runed';
	import { GuideEditor } from '@company-of-heroes/ui/guide';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const data = resource(
		() => page.params.id ?? '',
		async (id) => {
			const [guide, categories] = await Promise.all([
				unwrapApi(api.guides.get(id)),
				unwrapApi(api.guides.categories())
			]);
			return { guide, categories };
		}
	);
</script>

<SetCrumbs
	items={[
		{ label: t('Guides'), href: '/guides' },
		{ label: t('My guides'), href: '/guides/manage' },
		{ label: t('Edit guide') }
	]}
/>

{#if !app.account.canEditGuides}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Only editors and staff can do that.')}
	</p>
{:else if data.current && !data.current.guide.canEdit}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('You can only edit your own guides.')}
	</p>
{:else if data.current}
	<div class={flushHeader}>
		<h1 class={flushSectionTitle}>{t('Edit guide')}</h1>
	</div>
	{#key data.current.guide.id}
		<GuideEditor guide={data.current.guide} categories={data.current.categories} />
	{/key}
{:else if data.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Guide not found.')}
	</p>
{:else}
	<div class="flex flex-col gap-3 p-4">
		<Skeleton class="h-9 w-2/3" />
		<Skeleton class="h-96 w-full" />
	</div>
{/if}
