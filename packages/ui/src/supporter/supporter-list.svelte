<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import PlayerSupporterMedal from '../player/player-supporter-medal.svelte';
	import type { SupporterEntry } from './types';

	type Props = {
		entries: SupporterEntry[];
		/** Shown when there are no entries. */
		empty: string;
		/** The last list before the footer: its closing line overlaps the footer's own border. */
		last?: boolean;
	};

	let { entries, empty, last = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
</script>

<!-- Every row closes itself with a bottom line. -->
<ul class={cn(last && '-mb-px')}>
	{#each entries as entry (entry.steamId)}
		<li class="border-secondary-800 flex items-center gap-3 border-b px-4 py-2.5">
			<PlayerSupporterMedal force size={20} />
			{#if entry.avatarUrl}
				<img
					src={host.resolve.avatarUrl(entry.avatarUrl, { thumb: '100x100' })}
					alt=""
					loading="lazy"
					class="size-8 shrink-0 rounded-md object-cover"
				/>
			{:else}
				<span
					aria-hidden="true"
					class="bg-secondary-950 text-secondary-400 flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold"
				>
					{(entry.alias.trim()[0] ?? '?').toUpperCase()}
				</span>
			{/if}
			<a
				href={host.routes.player(entry.steamId)}
				class={cn(interactive, 'hover:text-primary min-w-0 flex-1 truncate font-medium text-white')}
			>
				{entry.alias}
			</a>
			<span class="text-secondary-400 shrink-0 text-sm tabular-nums">
				{entry.months === 1 ? t('1 month') : t('{count} months', { count: entry.months })}
			</span>
		</li>
	{:else}
		<li class="border-secondary-800 text-secondary-500 border-b px-4 py-4 text-sm">{empty}</li>
	{/each}
</ul>
