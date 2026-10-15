<script lang="ts">
	import { resource } from 'runed';
	import { GuideManageList } from '@company-of-heroes/ui/guide';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const guides = resource(
		() => app.account.canEditGuides,
		(allowed) => (allowed ? unwrapApi(api.guides.mine()) : Promise.resolve([]))
	);
</script>

<SetCrumbs items={[{ label: t('Guides'), href: '/guides' }, { label: t('My guides') }]} />

{#if !app.account.canEditGuides}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Only editors and staff can do that.')}
	</p>
{:else if guides.current}
	<GuideManageList guides={guides.current} />
{:else if guides.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Could not load guides.')}
	</p>
{:else}
	<div class="flex flex-col gap-3 p-4">
		<Skeleton class="h-6 w-40" />
		<Skeleton class="h-12 w-full" />
		<Skeleton class="h-12 w-full" />
	</div>
{/if}
