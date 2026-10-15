<script lang="ts" module>
	import type { DocSearchEntry } from '@company-of-heroes/game-data/types';

	let index: Promise<DocSearchEntry[]> | null = null;

	/** The game data (about 800 KB) is loaded once, the first time a picker opens. */
	function loadIndex(): Promise<DocSearchEntry[]> {
		index ??= import('@company-of-heroes/game-data')
			.then(({ loadGameDocs }) => loadGameDocs())
			.then((docs) => docs.searchIndex());
		return index;
	}
</script>

<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { watch } from 'runed';
	import DocsIcon from '../../docs/docs-icon.svelte';
	import { docsPath } from '../../docs/format';
	import { Selection } from '../input';

	type Props = {
		open: boolean;
		/** A wiki page was picked: its site path and display name. */
		onPick: (link: { href: string; name: string }) => void;
	};

	let { open = $bindable(false), onPick }: Props = $props();
	const { t } = useI18n();

	let entries = $state.raw<DocSearchEntry[]>([]);

	const KIND_LABELS: Record<DocSearchEntry['kind'], string> = {
		unit: 'Unit',
		building: 'Building',
		commander: 'Commander',
		weapon: 'Weapon',
		map: 'Map',
		upgrade: 'Upgrade'
	};

	watch(
		() => open,
		(isOpen) => {
			if (isOpen && !entries.length) {
				void loadIndex().then((loaded) => {
					entries = loaded;
				});
			}
		}
	);

	const options = $derived(
		entries.map((entry) => ({
			value: `${entry.kind}:${entry.slug}`,
			label: entry.name,
			meta: { kind: entry.kind, icon: entry.icon ?? '' }
		}))
	);

	function pick(value: string | string[]) {
		const [kind, ...rest] = String(value).split(':');
		const slug = rest.join(':');
		const entry = entries.find((item) => item.kind === kind && item.slug === slug);
		const href = entry && docsPath(entry);
		if (entry && href) {
			onPick({ href, name: entry.name });
		}
	}
</script>

<Selection
	hideTrigger
	bind:open
	{options}
	value=""
	onValueChange={pick}
	searchPlaceholder={t('Search units, buildings, upgrades…')}
	noResultsLabel={entries.length ? t('No results found.') : t('Loading…')}
	selectOptionLabel={t('Insert link')}
>
	{#snippet renderOption({ option })}
		<span class="flex min-w-0 flex-1 items-center gap-2">
			<DocsIcon icon={option.meta?.icon || undefined} name={option.label} class="size-6" />
			<span class="truncate">{option.label}</span>
			<span class="text-secondary-500 ml-auto shrink-0 text-xs">
				{t(KIND_LABELS[option.meta?.kind as DocSearchEntry['kind']] ?? 'Page')}
			</span>
		</span>
	{/snippet}
</Selection>
