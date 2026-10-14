<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Compare from '@company-of-heroes/ui/compare';
	import { useHost } from '@company-of-heroes/ui/host';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	const host = useHost();

	const compare = $derived(data.compare);
	// Toggling recombines in the browser; the URL only keeps the selection shareable.
	let selected = $derived(
		Compare.selectionFromParam(compare.accounts, page.url.searchParams.get('accounts'))
	);

	function onSelect(ids: string[]) {
		selected = ids;
		if (host.routes.compare) {
			replaceState(
				host.routes.compare(page.params.id ?? '', Compare.selectionParam(compare.accounts, ids)),
				{}
			);
		}
	}
</script>

<svelte:head>
	<title>{compare.them.alias} · {t('Compare')} | {t('Company of Heroes 1 Stats')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if compare.isSelf}
	<div class="border-secondary-800 -mb-px flex flex-col items-start gap-3 border-b px-4 py-6">
		<h1 class="text-xl font-semibold text-white">{t('This is you')}</h1>
		<p class="text-secondary-400 text-sm">
			{t('You cannot compare yourself with your own account.')}
		</p>
		<Button href={host.routes.player(compare.them.steamId)}>{t('Back to profile')}</Button>
	</div>
{:else}
	<Compare.Root {compare} {selected} {onSelect}>
		<div class="-mb-px">
			<Compare.Header />
			<Compare.Accounts />
			<Compare.HeadToHead />
			<Compare.Table />
			<Compare.Factions />
			<Compare.Maps />
		</div>
	</Compare.Root>
{/if}
