<script lang="ts">
	import type { Faction } from '@company-of-heroes/game-data/types';
	import { FACTION_RACE_ID } from '@company-of-heroes/game-data/factions';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import { getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';

	type Props = {
		/** Adds the faction's overview as a step. */
		faction?: Faction;
		/** A step between the wiki and this page (e.g. the weapons list). */
		parent?: { label: string; href: string };
		/** This page's name; the last step, not a link. */
		current: string;
	};

	let { faction, parent, current }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const raceId = $derived(faction ? FACTION_RACE_ID[faction] : null);
	const steps = $derived(
		[
			{ label: t('Wiki'), href: host.href('/wiki') },
			raceId !== null && faction
				? {
						label: t(getRaceLabel(raceId)),
						href: host.href(`/wiki?faction=${faction}`)
					}
				: null,
			parent ? { label: parent.label, href: host.href(parent.href) } : null
		].filter((step) => step !== null)
	);
	const back = $derived(steps.at(-1)!.href);
</script>

<!-- The back button and breadcrumb row from the replay pages. -->
<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
	<a
		href={back}
		aria-label={t('Back to wiki')}
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
