<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import { useHost } from '../host/host.context';
	import { useGuide } from './context';
	import type { GuideCategory, GuideSummary } from './types';

	const { t } = useI18n();
	const host = useHost();
	const guide = useGuide();

	const nav = $derived(guide.view.nav);

	/** Guides per category id (the nav holds every published guide of the language). */
	const byCategory = $derived.by(() => {
		const groups = new Map<string, GuideSummary[]>();
		for (const item of nav.guides) {
			const id = item.category?.id;
			if (id) {
				groups.set(id, [...(groups.get(id) ?? []), item]);
			}
		}

		return groups;
	});

	/** Guides in a top-level category, its subcategories included. */
	const total = (id: string) =>
		(byCategory.get(id)?.length ?? 0) +
		(nav.tree.find((top) => top.id === id)?.children ?? []).reduce(
			(sum, child) => sum + (byCategory.get(child.id)?.length ?? 0),
			0
		);

	/** Everything starts open; a click on the caret folds a category away. */
	const collapsed = new SvelteSet<string>();

	function toggle(id: string) {
		if (collapsed.has(id)) {
			collapsed.delete(id);
		} else {
			collapsed.add(id);
		}
	}

	const categoryHref = (category: GuideCategory) => host.routes.guide(`/guides/${category.path}`);
	const guideHref = (item: GuideSummary) =>
		item.path ? host.routes.guide(item.path) : host.routes.guides();

	/** Category rows: flush, a primary bar on the left edge when it is the open page. */
	const row = (active: boolean) =>
		cn(
			'flex items-stretch border-l-2 transition-colors',
			active
				? 'border-primary bg-secondary-800/40 text-white'
				: 'hover:bg-secondary-800/20 text-secondary-300 border-transparent hover:text-white'
		);

	const rowLink = cn(interactive, 'flex min-w-0 flex-1 items-center py-2.5 pr-2 pl-3.5 text-sm');
</script>

{#snippet guideList(items: GuideSummary[])}
	<!-- Guides hang off one thin line; the open guide lights up its own piece of it. -->
	<ul class="border-secondary-800 mr-4 ml-4 border-l">
		{#each items as item (item.id)}
			{@const active = nav.guideId === item.id}
			<li>
				<a
					href={guideHref(item)}
					class={cn(
						interactive,
						'-ml-px block border-l py-1.5 pl-3 text-sm leading-snug transition-colors',
						active
							? 'border-primary text-white'
							: 'text-secondary-400 hover:border-secondary-500 border-transparent hover:text-white'
					)}
					aria-current={active ? 'page' : undefined}
				>
					{item.title || t('Untitled guide')}
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<nav aria-label={t('Guide categories')}>
	<div class={row(guide.view.kind === 'index')}>
		<a
			href={host.routes.guides()}
			class={rowLink}
			aria-current={guide.view.kind === 'index' ? 'page' : undefined}
		>
			{t('All guides')}
		</a>
	</div>

	{#each nav.tree as top (top.id)}
		{@const open = !collapsed.has(top.id)}
		{@const count = total(top.id)}
		<section class="border-secondary-800 border-t">
			<div class={row(nav.categoryId === top.id)}>
				<a
					href={categoryHref(top)}
					class={cn(rowLink, 'text-xs font-semibold tracking-wide uppercase')}
					aria-current={nav.categoryId === top.id ? 'page' : undefined}
				>
					<span class="truncate">{top.name}</span>
					{#if count}
						<span class="text-secondary-500 ml-auto pl-2 tabular-nums">{count}</span>
					{/if}
				</a>
				<button
					type="button"
					class={cn(
						interactive,
						'text-secondary-500 flex w-9 shrink-0 items-center justify-center transition-colors hover:text-white'
					)}
					aria-expanded={open}
					aria-label={open
						? t('Collapse {name}', { name: top.name })
						: t('Expand {name}', { name: top.name })}
					onclick={() => toggle(top.id)}
				>
					<CaretRightIcon
						size={12}
						weight="bold"
						class={cn('transition-transform duration-200', open && 'rotate-90')}
					/>
				</button>
			</div>
			{#if open}
				<div transition:slide={{ duration: 150 }} class="flex flex-col gap-1 pb-3">
					{#if byCategory.get(top.id)?.length}
						{@render guideList(byCategory.get(top.id) ?? [])}
					{/if}
					{#each top.children as child (child.id)}
						{@const items = byCategory.get(child.id) ?? []}
						<div>
							<a
								href={categoryHref(child)}
								class={cn(
									interactive,
									'block px-4 pt-1.5 pb-1 text-sm font-medium transition-colors',
									nav.categoryId === child.id
										? 'text-primary'
										: 'text-secondary-200 hover:text-white'
								)}
								aria-current={nav.categoryId === child.id ? 'page' : undefined}
							>
								{child.name}
							</a>
							{#if items.length}
								{@render guideList(items)}
							{/if}
						</div>
					{/each}
					{#if !top.children.length && !byCategory.get(top.id)?.length}
						<p class="text-secondary-500 px-4 text-xs">{t('No guides yet.')}</p>
					{/if}
				</div>
			{/if}
		</section>
	{/each}

	{#if !nav.tree.length}
		<p class="text-secondary-500 border-secondary-800 border-t px-4 py-3 text-sm">
			{t('No categories yet.')}
		</p>
	{/if}
</nav>
