<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DocCost, Faction } from '@company-of-heroes/game-data/types';
	import { FACTION_RACE_ID } from '@company-of-heroes/game-data/factions';
	import { useI18n } from '@company-of-heroes/i18n';
	import { getRaceLabel } from '../format/player-format';
	import DocsBreadcrumb from './docs-breadcrumb.svelte';
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
		/** A breadcrumb step between the wiki and this page (the weapons list on weapon pages). */
		parent?: { label: string; href: string };
		/** Doctrine banner, faded behind the header like in the stats popover. */
		banner?: string | null;
		/** Extra content under the description (e.g. reinforce cost). */
		children?: Snippet;
	};

	let { name, icon, faction, kicker, help, extra, cost, pop, banner, parent, children }: Props =
		$props();
	const { t } = useI18n();

	const raceId = $derived(faction ? FACTION_RACE_ID[faction] : null);
</script>

<DocsBreadcrumb {faction} {parent} current={name} />

<!-- The stats popover header at page size: icon, name, kind · faction, cost, help. -->
<header class="border-secondary-800 relative isolate overflow-hidden border-b px-4 py-6">
	{#if banner}
		<img
			src={banner}
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-left opacity-35"
		/>
		<div
			class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-gray-950/30 via-gray-950/70 to-gray-950"
		></div>
	{/if}
	<div class="flex items-center gap-4">
		<DocsIcon {icon} {name} class="size-16" />
		<div class="min-w-0 flex-1">
			<h1 class="font-heading text-3xl leading-tight font-bold text-white">{name}</h1>
			<p class="text-secondary-400 mt-1 text-sm">
				{kicker}
				{#if raceId !== null}
					<span class="text-secondary-500">·</span>
					{t(getRaceLabel(raceId))}
				{/if}
			</p>
		</div>
	</div>
	{#if cost || pop}
		<DocsCost {cost} {pop} class="mt-4" />
	{/if}
	{#if help || extra}
		<div class="mt-3 max-w-3xl text-sm">
			{#if help}
				<p class="text-secondary-300 leading-relaxed">{help}</p>
			{/if}
			{#if extra}
				<p class="text-primary mt-1.5 font-semibold">{extra}</p>
			{/if}
		</div>
	{/if}
	{@render children?.()}
</header>
