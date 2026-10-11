<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { crumbsFromPath, useBreadcrumbs } from './crumbs.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const breadcrumbs = useBreadcrumbs();
	const crumbs = $derived(
		breadcrumbs.trail ?? crumbsFromPath(page.url.pathname, breadcrumbs.extra)
	);
</script>

<nav aria-label={t('Breadcrumb')}>
	<ol class="font-heading flex items-center text-sm font-bold">
		{#each crumbs as crumb, i (crumb.label + String(i))}
			{#if i > 0}
				<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
			{/if}
			<li>
				{#if crumb.href && i < crumbs.length - 1}
					<a href={crumb.href} class={cn(interactive, 'text-secondary-400 hover:text-primary')}>
						{crumb.label}
					</a>
				{:else}
					<span class="text-white">{crumb.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
