<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import { useHost } from '../host/host.context';
	import type { GuideCategory } from './types';

	type Props = {
		/** The category chain above the page (top-level first). */
		categories: GuideCategory[];
		/** This page's name; the last step, not a link. */
		current: string;
	};

	let { categories, current }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const steps = $derived([
		{ label: t('Guides'), href: host.routes.guides() },
		...categories.map((category) => ({
			label: category.name,
			href: host.routes.guide(`/guides/${category.path}`)
		}))
	]);
	const back = $derived(steps[steps.length - 1].href);

	$effect(() => host.breadcrumbs?.([...steps, { label: current }]));
</script>

<!-- The breadcrumb row of the wiki pages; the app shows it in its header instead. -->
{#if !host.breadcrumbs}
	<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
		<a
			href={back}
			aria-label={t('Back to guides')}
			class={cn(
				interactive,
				'border-secondary-600 bg-secondary-800 hover:border-secondary-500 hover:bg-secondary-700 inline-flex size-9 shrink-0 items-center justify-center rounded-md border text-white'
			)}
		>
			<ArrowLeftIcon class="size-4" weight="duotone" />
		</a>
		<nav aria-label="Breadcrumb" class="font-heading min-w-0 text-sm font-bold">
			<ol class="flex min-w-0 items-baseline">
				{#each steps as step (step.href)}
					<li class="shrink-0">
						<a href={step.href} class={cn(interactive, 'text-secondary-400 hover:text-primary')}>
							{step.label}
						</a>
					</li>
					<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
				{/each}
				<li class="min-w-0 truncate text-white" aria-current="page">{current}</li>
			</ol>
		</nav>
	</div>
{/if}
