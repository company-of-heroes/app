<script lang="ts">
	import { replaceState } from '$app/navigation';
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

	const result = resource(
		() => page.params.id,
		(id) => unwrapApi(api.compare.get({ them: id! }))
	);

	// Another player's result never shows under this player's URL while it loads.
	const compare = $derived.by(() => {
		const current = result.current;
		const id = page.params.id;
		const matches =
			current && (current.them.steamId === id || String(current.them.profileId) === id);
		return matches ? current : undefined;
	});
	// Toggling recombines in the browser; the URL only keeps the selection.
	let selected = $derived(
		compare
			? Compare.selectionFromParam(compare.accounts, page.url.searchParams.get('accounts'))
			: []
	);

	function onSelect(ids: string[]) {
		if (!compare) {
			return;
		}

		selected = ids;
		replaceState(
			host.routes.compare!(page.params.id!, Compare.selectionParam(compare.accounts, ids)),
			{}
		);
	}
</script>

<SetCrumbs
	items={[
		{ label: t('Players'), href: '/players' },
		...(compare ? [{ label: compare.them.alias, href: host.routes.player(page.params.id!) }] : []),
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
