<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle, interactive } from '@company-of-heroes/ui/variants';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { GUIDE_LANGUAGE_NAMES, GUIDE_STATUS_LABELS } from './format';
	import type { GuideLanguage, GuideSummary } from './types';

	type Props = {
		guides: GuideSummary[];
	};

	let { guides }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let creating = $state(false);

	/** A new draft in the viewer's language; the editor opens on it right away. */
	async function create() {
		if (creating) {
			return;
		}

		creating = true;
		try {
			const language = host.locale() as GuideLanguage;
			const guide = await host.api.guides.create(
				language in GUIDE_LANGUAGE_NAMES ? language : 'en'
			);
			await host.url.goto(host.routes.guideEdit(guide.id));
		} catch (error) {
			host.notify.error(
				error instanceof Error ? t(error.message) : t('Could not create the guide.')
			);
		} finally {
			creating = false;
		}
	}
</script>

<div class={cn(flushHeader, 'flex items-center justify-between gap-3')}>
	<h1 class={flushHeaderTitle}>{t('My guides')}</h1>
	<Button type="button" size="sm" loading={creating} onclick={create}>
		<PlusIcon size={14} />
		{t('New guide')}
	</Button>
</div>
{#if guides.length === 0}
	<div class="text-secondary-500 flex items-center gap-3 px-4 py-6 text-sm">
		<BookOpenIcon size={20} weight="duotone" class="shrink-0" />
		<p>{t('No guides yet. Start one with "New guide".')}</p>
	</div>
{:else}
	<!-- Every row closes with its own line; the list overlaps the panel's closing line by 1px. -->
	<ul class="-mb-px">
		{#each guides as guide (guide.id)}
			<li class="border-secondary-800 border-b">
				<a
					href={host.routes.guideEdit(guide.id)}
					class={cn(
						interactive,
						'hover:bg-secondary-900/50 flex items-center gap-4 px-4 py-3 transition-colors'
					)}
				>
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium text-white">{guide.title || t('Untitled guide')}</p>
						<p class="text-secondary-400 truncate text-xs">
							{guide.category?.path.replace('/', ' › ') ?? t('No category')}
							<span class="text-secondary-600 mx-1">·</span>
							{GUIDE_LANGUAGE_NAMES[guide.language]}
							<span class="text-secondary-600 mx-1">·</span>
							{guide.author.name}
						</p>
					</div>
					{#if guide.reviewRequestedAt}
						<Badge variant="info" class="shrink-0">{t('In review')}</Badge>
					{:else if guide.hasRevision}
						<Badge variant="warning" class="shrink-0">{t('Unpublished changes')}</Badge>
					{/if}
					<Badge variant={guide.status === 'published' ? 'success' : 'warning'} class="shrink-0">
						{t(GUIDE_STATUS_LABELS[guide.status])}
					</Badge>
					<time
						datetime={guide.updated}
						class="text-secondary-400 hidden shrink-0 text-xs sm:block"
					>
						{formatDate(guide.updated, host.locale(), 'dateTime')}
					</time>
				</a>
			</li>
		{/each}
	</ul>
{/if}
