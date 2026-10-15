<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { flushHeader, flushHeaderTitle, interactive } from '@company-of-heroes/ui/variants';
	import { cn } from '@company-of-heroes/ui/cn';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import { useHost } from '../host/host.context';
	import * as Accordion from '../ui/accordion';
	import { Button } from '../ui/button';
	import { Pagination } from '../ui/pagination';
	import GuideArticle from './guide-article.svelte';
	import GuideBreadcrumb from './guide-breadcrumb.svelte';
	import GuideList from './guide-list.svelte';
	import GuideNav from './guide-nav.svelte';
	import GuideRoot from './guide-root.svelte';
	import type { GuideCategory, GuideView } from './types';

	type Props = {
		view: GuideView;
	};

	let { view }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	/** The category chain above a page (top-level first), from the nav tree. */
	function chain(category: GuideCategory | null): GuideCategory[] {
		if (!category) {
			return [];
		}

		const parent = category.parent
			? view.nav.tree.find((top) => top.id === category.parent)
			: undefined;
		return parent ? [parent, category] : [category];
	}

	function goToPage(path: string, page: number) {
		void host.url.goto(host.routes.guide(page > 1 ? `${path}?page=${page}` : path));
	}
</script>

<GuideRoot {view}>
	<!-- A narrow nav column and the content; both columns close every block with a line and the
	grid sits 1px over what follows (the footer's top line), like the docs layout. -->
	<div
		class="divide-secondary-800 -mb-px grid flex-1 content-start lg:grid-cols-[18rem_minmax(0,1fr)] lg:content-stretch lg:divide-x"
	>
		<aside class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
			<div class="lg:hidden">
				<Accordion.Root class="gap-0">
					<Accordion.Item value="nav">
						{#snippet header()}
							<span class={cn(flushHeaderTitle, 'flex items-center gap-2 px-4 py-3')}>
								<ListIcon size={14} />
								{t('Browse guides')}
							</span>
						{/snippet}
						<GuideNav />
					</Accordion.Item>
				</Accordion.Root>
			</div>
			<div class="hidden lg:block">
				<div class={flushHeader}>
					<h2 class={flushHeaderTitle}>{t('Guides')}</h2>
				</div>
				<GuideNav />
			</div>
		</aside>
		<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
			{#if view.kind === 'guide'}
				<GuideBreadcrumb categories={chain(view.guide.category)} current={view.guide.title} />
				<GuideArticle guide={view.guide} />
			{:else if view.kind === 'category'}
				<GuideBreadcrumb
					categories={view.parent ? [view.parent] : []}
					current={view.category.name}
				/>
				<header class="px-4 py-6 sm:px-6">
					<h1 class="font-heading text-3xl leading-tight font-bold text-white">
						{view.category.name}
					</h1>
					<p class="text-secondary-400 mt-2 text-sm">
						{view.list.total === 1 ? t('1 guide') : t('{count} guides', { count: view.list.total })}
					</p>
					{#if view.children.length}
						<ul class="mt-4 flex flex-wrap gap-2">
							{#each view.children as child (child.id)}
								<li>
									<Button
										variant="secondary"
										size="sm"
										href={host.routes.guide(`/guides/${child.path}`)}
									>
										{child.name}
									</Button>
								</li>
							{/each}
						</ul>
					{/if}
				</header>
				<GuideList
					guides={view.list.items}
					emptyMessage={t('No guides in this category yet.')}
					showCategory={view.children.length > 0}
				/>
				{#if view.list.total > view.list.perPage}
					<div class="flex justify-center px-4 py-3">
						<Pagination
							page={view.list.page}
							count={view.list.total}
							perPage={view.list.perPage}
							onPage={(page) => goToPage(`/guides/${view.category.path}`, page)}
							pageNumberLabel={t('Page number')}
						/>
					</div>
				{/if}
			{:else}
				<header class="flex flex-wrap items-start justify-between gap-4 px-4 py-6 sm:px-6">
					<div>
						<h1 class="font-heading text-3xl leading-tight font-bold text-white">{t('Guides')}</h1>
						<p class="text-secondary-400 mt-2 max-w-2xl text-sm">
							{t(
								'Strategy guides and build orders for Company of Heroes, written by the community.'
							)}
						</p>
					</div>
					{#if host.auth.user?.canEdit}
						<Button
							variant="secondary"
							size="sm"
							href={host.routes.guidesManage()}
							class={interactive}
						>
							<PencilSimpleIcon size={14} />
							{t('My guides')}
						</Button>
					{/if}
				</header>
				<GuideList guides={view.latest} emptyMessage={t('No guides yet.')} showCategory />
			{/if}
		</div>
	</div>
</GuideRoot>
