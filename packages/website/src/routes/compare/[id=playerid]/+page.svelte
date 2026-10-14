<script lang="ts">
	import { goto } from '$app/navigation';
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

	function onSelect(ids: string[]) {
		const next = ids.length === compare.accounts.length ? undefined : ids;
		void goto(host.routes.compare?.(page.params.id ?? '', next) ?? '', {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>{t('Compare')} · {compare.them.alias}</title>
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
	<Compare.Root {compare} selected={data.selected} {onSelect}>
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
