<script lang="ts">
	import { DocsUpgradePage } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { breadcrumbList } from '$lib/site/seo';
	import { getActionIcon } from '$lib/utils/media/action-icons';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const upgrade = $derived(page.upgrade);
	const description = $derived(
		upgrade.help ||
			t('Cost, effects and what the {name} upgrade unlocks in Company of Heroes.', {
				name: upgrade.name
			})
	);
	const image = $derived(upgrade.icon ? getActionIcon(upgrade.icon) : undefined);
	const jsonLd = $derived(
		breadcrumbList([
			{ name: t('Wiki'), href: href('/wiki') },
			{ name: upgrade.name, href: href(`/wiki/upgrades/${upgrade.slug}`) }
		])
	);
</script>

<Seo
	title="{upgrade.name} | {t('Wiki')}"
	ogTitle={upgrade.name}
	description={description || undefined}
	{image}
	{jsonLd}
/>

<DocsUpgradePage {page} />
