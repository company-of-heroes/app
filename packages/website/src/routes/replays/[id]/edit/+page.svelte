<script lang="ts">
	import { goto } from '$app/navigation';
	import { ReplayEditForm } from '@company-of-heroes/ui/replay';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const match = $derived(data.match);
	const detailHref = $derived(href(`/replays/${match.id}`));
	const memberReplaysHref = $derived(href('/replays?tab=member'));
</script>

<svelte:head>
	<title>{t('Edit replay')} | {t('Company of Heroes 1 Stats')}</title>
</svelte:head>

<div class="border-secondary-800 border">
	<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
		<a
			href={detailHref}
			aria-label={t('Go back')}
			class={cn(
				interactive,
				'border-secondary-600 bg-secondary-800 hover:border-secondary-500 hover:bg-secondary-700 inline-flex size-9 shrink-0 items-center justify-center rounded-md border text-white'
			)}
		>
			<ArrowLeftIcon class="size-4" weight="duotone" />
		</a>
		<nav aria-label="Breadcrumb" class="font-heading min-w-0 text-sm font-bold">
			<ol class="flex items-center">
				<li>
					<a
						href={memberReplaysHref}
						class={cn(interactive, 'text-secondary-400 hover:text-primary')}
					>
						{t('Replays')}
					</a>
				</li>
				<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
				<li>
					<a href={detailHref} class={cn(interactive, 'text-secondary-400 hover:text-primary')}>
						{match.title?.trim() || t('Replay')}
					</a>
				</li>
				<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
				<li class="min-w-0 truncate text-white">{t('Edit')}</li>
			</ol>
		</nav>
	</div>

	{#key match.id}
		<ReplayEditForm
			{match}
			onDone={() => void goto(detailHref, { invalidateAll: true })}
			onCancel={() => void goto(detailHref)}
			onDeleted={() => void goto(memberReplaysHref, { invalidateAll: true })}
		/>
	{/key}
</div>
