<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import { getModeLabel, getRaceLabel } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';

	type Props = {
		match: {
			/** Lobby id of the saved match; the badge links to it. */
			id?: string | null;
			outcome: 0 | 1;
			raceId: number | null;
			matchtypeId: number | null;
		};
		/** Filled square that stretches to its grid cell, for `MatchResultStrip`. */
		block?: boolean;
		class?: string;
	};

	let { match, block = false, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const won = $derived(match.outcome === 1);
	const href = $derived(match.id ? host.routes.match(match.id) : null);
	const details = $derived(
		[
			match.raceId != null ? getRaceLabel(match.raceId) : null,
			match.matchtypeId != null ? getModeLabel(match.matchtypeId) : null
		].filter((part): part is string => !!part)
	);
	const content = $derived(
		[
			`<span class="font-semibold ${won ? 'text-green-400' : 'text-red-400'}">${escapeHtml(won ? t('Win') : t('Loss'))}</span>`,
			...details.map((part) => `<span class="text-secondary-300">${escapeHtml(part)}</span>`)
		].join('<span class="text-secondary-600"> · </span>')
	);
</script>

{#snippet result()}
	{#if block}
		<span
			class={cn(
				'flex h-5 w-full items-center justify-center rounded-sm border text-[10px] leading-none font-bold transition-colors',
				won
					? 'border-success/40 bg-success/15 group-hover:bg-success/30 text-green-400'
					: 'border-destructive/40 bg-destructive/15 group-hover:bg-destructive/30 text-red-400'
			)}
		>
			{won ? t('W') : t('L')}
		</span>
	{:else}
		<Badge variant={won ? 'success' : 'destructive'}>{won ? t('W') : t('L')}</Badge>
	{/if}
{/snippet}

<!-- One recent result: W/L badge with the match details on hover, linking to the match. -->
{#if href}
	<a
		{href}
		class={cn(interactive, block ? 'group flex min-w-0' : 'inline-flex shrink-0', className)}
		aria-label={won ? t('Win') : t('Loss')}
		{@attach tooltip(content)}
	>
		{@render result()}
	</a>
{:else}
	<span
		class={cn(block ? 'flex min-w-0' : 'inline-flex shrink-0', className)}
		{@attach tooltip(content)}
	>
		{@render result()}
	</span>
{/if}
