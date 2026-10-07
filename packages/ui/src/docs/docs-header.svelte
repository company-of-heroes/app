<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DocCost, Faction } from '@company-of-heroes/game-data/types';
	import { FACTION_RACE_ID } from '@company-of-heroes/game-data/factions';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive } from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import DocsCost from './docs-cost.svelte';
	import DocsIcon from './docs-icon.svelte';

	type Props = {
		name: string;
		icon?: string;
		faction?: Faction;
		/** Kind shown above the name ("Unit", "Building", …). */
		kicker: string;
		help?: string;
		/** Usually "Good vs. …". */
		extra?: string;
		cost?: DocCost;
		pop?: number;
		/** Extra content under the description (e.g. reinforce cost). */
		children?: Snippet;
	};

	let { name, icon, faction, kicker, help, extra, cost, pop, children }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const raceId = $derived(faction ? FACTION_RACE_ID[faction] : null);
	const backHref = $derived(host.href(faction ? `/docs?faction=${faction}` : '/docs'));
</script>

<header class="border-secondary-800 border-b p-4">
	<a
		href={backHref}
		class={cn(
			interactive,
			'text-secondary-400 hover:text-primary mb-4 inline-flex items-center gap-1.5 text-sm transition-colors'
		)}
	>
		<ArrowLeftIcon size={14} />
		{t('Documentation')}
	</a>
	<div class="flex items-start gap-4">
		<DocsIcon {icon} {name} class="size-16 sm:size-20" />
		<div class="min-w-0 flex-1">
			<p
				class="text-secondary-400 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase"
			>
				{#if raceId !== null}
					<img
						src={host.resolve.factionFlagByRace(raceId)}
						alt=""
						class={cn(factionIcon, 'size-4')}
					/>
					{t(getRaceLabel(raceId))} ·
				{/if}
				{kicker}
			</p>
			<h1 class="font-heading mt-1 text-2xl font-bold text-white sm:text-3xl">{name}</h1>
			{#if cost || pop}
				<DocsCost {cost} {pop} class="mt-2" />
			{/if}
		</div>
	</div>
	{#if help || extra}
		<div class="mt-4 max-w-3xl">
			{#if help}
				<p class="text-secondary-200">{help}</p>
			{/if}
			{#if extra}
				<Badge variant="default" class="mt-2">{extra}</Badge>
			{/if}
		</div>
	{/if}
	{@render children?.()}
</header>
