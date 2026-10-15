<script lang="ts">
	import { GuideBrowser } from '@company-of-heroes/ui/guide';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { guideJsonLd } from '$lib/site/guide-seo';
	import { breadcrumbList } from '$lib/site/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const view = $derived(data.view);
	const crumbs = $derived.by(() => {
		const steps = [{ name: t('Guides'), href: href('/guides') }];
		if (view.kind === 'category') {
			if (view.parent) {
				steps.push({ name: view.parent.name, href: href(`/guides/${view.parent.path}`) });
			}

			steps.push({ name: view.category.name, href: href(`/guides/${view.category.path}`) });
		}

		if (view.kind === 'guide') {
			const category = view.guide.category;
			const parent = category?.parent
				? view.nav.tree.find((top) => top.id === category.parent)
				: undefined;
			if (parent) {
				steps.push({ name: parent.name, href: href(`/guides/${parent.path}`) });
			}

			if (category) {
				steps.push({ name: category.name, href: href(`/guides/${category.path}`) });
			}

			steps.push({ name: view.guide.title, href: href(view.guide.path ?? '/guides') });
		}

		return breadcrumbList(steps);
	});
</script>

{#if view.kind === 'guide' && data.seo}
	<Seo
		title={view.guide.seoTitle || view.guide.title}
		ogTitle={view.guide.title}
		description={view.guide.seoDescription || view.guide.excerpt || undefined}
		image={view.guide.coverUrl ?? undefined}
		type="article"
		canonicalPath={data.seo.canonicalPath}
		alternates={data.seo.alternates}
		article={data.seo.article}
		noindex={data.seo.noindex}
		jsonLd={[guideJsonLd(view.guide, data.seo), crumbs]}
	/>
{:else if view.kind === 'guide'}
	<Seo title={view.guide.title || t('Untitled guide')} noindex />
{:else if view.kind === 'category'}
	<Seo
		title={t('{name} guides', { name: view.category.name })}
		description={t(
			'Company of Heroes strategy guides and build orders for {name}, written by the community.',
			{ name: view.category.name }
		)}
		jsonLd={crumbs}
	/>
{:else}
	<Seo
		title={t('Guides')}
		description={t(
			'Strategy guides and build orders for Company of Heroes, written by the community.'
		)}
		jsonLd={crumbs}
	/>
{/if}

<GuideBrowser {view} />
