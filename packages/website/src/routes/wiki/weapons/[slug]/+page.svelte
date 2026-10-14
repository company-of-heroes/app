<script lang="ts">
	import { DocsWeaponPage } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { breadcrumbList } from '$lib/site/seo';
	import { getActionIcon } from '$lib/utils/media/action-icons';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(
		t('Damage, accuracy, range and penetration of the {name}.', { name: page.weapon.name })
	);
	const image = $derived(page.weapon.icon ? getActionIcon(page.weapon.icon) : undefined);
	const jsonLd = $derived(
		breadcrumbList([
			{ name: t('Wiki'), href: href('/wiki') },
			{ name: t('Weapons'), href: href('/wiki/weapons') },
			{ name: page.weapon.name, href: href(`/wiki/weapons/${page.weapon.slug}`) }
		])
	);
</script>

<Seo
	title="{page.weapon.name} | {t('Wiki')}"
	ogTitle={page.weapon.name}
	description={description || undefined}
	{image}
	{jsonLd}
/>

<DocsWeaponPage {page} />
