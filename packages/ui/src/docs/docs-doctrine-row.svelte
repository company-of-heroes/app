<script lang="ts">
	import type { DocRef } from '@company-of-heroes/game-data/types';
	import { cn } from '@company-of-heroes/ui/cn';
	import DocsIcon from './docs-icon.svelte';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { doctrineBannerFile } from '../replay/replay-stats';
	import { popoverEntry, useDocsPopover } from './docs-popover.context';
	import { docsPath } from './format';

	type Props = {
		commander: DocRef;
		/** Grey line under the name. */
		note?: string;
		/** A large card with the banner clearly visible (overview header row). */
		large?: boolean;
	};

	let { commander, note, large = false }: Props = $props();
	const host = useHost();
	const popover = useDocsPopover();

	const entry = $derived(popoverEntry(commander));
	const trigger = $derived(popover && entry ? popover.hoverTrigger(entry) : {});
	const banner = $derived.by(() => {
		if (commander.id === undefined || !commander.faction) {
			return null;
		}

		const file = doctrineBannerFile({ doctrine: commander.id, faction: commander.faction });
		return file ? host.resolve.doctrineBanner(file) : null;
	});
</script>

<!-- The doctrine row from /stats: the in-game banner faded behind the name. -->
<div class={cn('relative isolate h-full overflow-hidden', large && 'bg-gray-950')}>
	{#if banner}
		<img
			src={banner}
			alt=""
			aria-hidden="true"
			class={cn(
				'pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-left',
				large ? 'opacity-40' : 'opacity-[0.16]'
			)}
		/>
		<div
			class={cn(
				'pointer-events-none absolute inset-0 -z-10 bg-linear-to-r',
				large
					? 'from-gray-950/20 via-gray-950/60 to-gray-950/90'
					: 'from-secondary-950/25 via-secondary-950/60 to-secondary-950/92'
			)}
		></div>
	{/if}
	<a
		href={host.href(docsPath(commander) ?? '/wiki')}
		class={cn(
			interactive,
			'relative flex h-full w-full items-center gap-3 text-left transition-colors',
			large ? 'gap-4 px-4 py-6 hover:bg-gray-950/30' : 'hover:bg-secondary-950/40 px-4 py-2.5'
		)}
		{...trigger}
	>
		{#if large}
			<DocsIcon icon={commander.icon} name={commander.name} class="size-14 drop-shadow-lg" />
		{/if}
		<div class="min-w-0 flex-1">
			<p
				class={cn(
					'truncate text-white',
					large ? 'font-heading text-xl leading-tight font-bold' : 'font-medium'
				)}
			>
				{commander.name}
			</p>
			{#if note}
				<p class={cn('text-secondary-400 text-xs', large && 'text-secondary-300 mt-1 text-sm')}>
					{note}
				</p>
			{/if}
		</div>
	</a>
</div>
