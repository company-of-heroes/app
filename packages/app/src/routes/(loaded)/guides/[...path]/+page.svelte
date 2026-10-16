<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resource } from 'runed';
	import type { GuideLanguage, GuideView } from '@company-of-heroes/ui/guide';
	import { GuideBrowser, GuideBrowserSkeleton } from '@company-of-heroes/ui/guide';
	import { api, unwrapApi } from '$core/api';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { getI18n, useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const path = $derived(page.params.path ?? '');
	const pageNumber = $derived(Math.max(1, Number(page.url.searchParams.get('page')) || 1));
	/** Translation links ask for their own language; otherwise the app's language. */
	const language = $derived.by((): GuideLanguage => {
		const asked = page.url.searchParams.get('lang');
		return asked === 'en' || asked === 'es' || asked === 'ko'
			? asked
			: (getI18n().getLocale() as GuideLanguage);
	});

	/**
	 * What the skeleton draws before the website answers: the index, a top-level category, or
	 * (for deeper paths) a guide, the most common page under a category.
	 */
	const loadingKind = $derived.by(() => {
		const depth = path.split('/').filter(Boolean).length;
		return depth === 0 ? 'index' : depth === 1 ? 'category' : 'guide';
	});

	/** The website resolves the path; a moved guide answers with its new address. */
	const view = resource(
		() => [path, pageNumber, language] as const,
		async ([current, number, lang]): Promise<GuideView | null> => {
			const resolved = await unwrapApi(api.guides.resolve(current, lang, number));
			if (resolved.kind === 'redirect') {
				await goto(resolved.path, { replaceState: true });
				return null;
			}

			return resolved;
		}
	);
</script>

<SetCrumbs items={[{ label: t('Guides') }]} />

{#if view.current}
	{#key path}
		<GuideBrowser view={view.current} />
	{/key}
{:else if view.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Guide not found.')}
	</p>
{:else}
	<GuideBrowserSkeleton kind={loadingKind} />
{/if}
