<script lang="ts">
	import { resource } from 'runed';
	import { GuideManageList, GuideManageListSkeleton } from '@company-of-heroes/ui/guide';
	import { Button } from '$lib/components/ui/button';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const guides = resource(
		() => app.account.isAuthenticated,
		(allowed) => (allowed ? unwrapApi(api.guides.mine()) : Promise.resolve([]))
	);
</script>

<SetCrumbs items={[{ label: t('Guides'), href: '/guides' }, { label: t('My guides') }]} />

{#if !app.account.isAuthenticated}
	<div
		class="border-secondary-800 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
	>
		<p class="text-secondary-400 text-sm">{t('Log in to write a guide.')}</p>
		<Button href="/account" variant="secondary" size="sm">{t('Log in')}</Button>
	</div>
{:else if guides.current}
	<GuideManageList guides={guides.current} />
{:else if guides.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Could not load guides.')}
	</p>
{:else}
	<GuideManageListSkeleton />
{/if}
