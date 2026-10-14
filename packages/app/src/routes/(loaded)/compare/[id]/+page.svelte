<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Compare from '@company-of-heroes/ui/compare';
	import { useHost } from '@company-of-heroes/ui/host';
	import { resource } from 'runed';
	import { api, unwrapApi } from '$core/api';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const host = useHost();

	const accounts = $derived(page.url.searchParams.get('accounts') ?? '');

	const result = resource(
		() => [page.params.id, accounts] as const,
		([id, acc]) =>
			unwrapApi(api.compare.get({ them: id!, steamIds: acc ? acc.split(',') : undefined }))
	);

	// Keeps the previous result up while a toggle refetches, so the panels do not flash.
	const compare = $derived.by(() => {
		const current = result.current;
		const id = page.params.id;
		const matches =
			current && (current.them.steamId === id || String(current.them.profileId) === id);
		return matches ? current : undefined;
	});
	const selected = $derived(
		compare?.accounts.filter((account) => account.selected).map((account) => account.steamId) ?? []
	);

	function onSelect(ids: string[]) {
		if (!compare) {
			return;
		}

		const next = ids.length === compare.accounts.length ? undefined : ids;
		const href = host.routes.compare!(page.params.id!, next);
		void goto(href, { keepFocus: true, noScroll: true });
	}
</script>

<SetCrumbs
	items={[
		{ label: t('Players'), href: '/players' },
		...(compare
			? [{ label: compare.them.alias, href: host.routes.player(page.params.id!) }]
			: []),
		{ label: t('Compare') }
	]}
/>

{#if result.error}
	<div class="border-secondary-800 border-b px-4 py-6">
		<p class="text-secondary-400 text-sm">{t('Could not load the comparison.')}</p>
	</div>
{:else if compare?.isSelf}
	<div class="border-secondary-800 flex flex-col items-start gap-3 border-b px-4 py-6">
		<h1 class="text-xl font-semibold text-white">{t('This is you')}</h1>
		<p class="text-secondary-400 text-sm">
			{t('You cannot compare yourself with your own account.')}
		</p>
		<Button href={host.routes.player(compare.them.steamId)}>{t('Back to profile')}</Button>
	</div>
{:else if compare}
	<Compare.Root {compare} {selected} {onSelect}>
		<Compare.Header />
		<Compare.Accounts />
		<Compare.HeadToHead />
		<Compare.Table />
		<Compare.Factions />
		<Compare.Maps />
	</Compare.Root>
{:else}
	<Compare.Skeleton />
{/if}
