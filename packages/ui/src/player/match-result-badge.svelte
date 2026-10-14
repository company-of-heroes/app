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
		class?: string;
	};

	let { match, class: className }: Props = $props();
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

<!-- One recent result: W/L badge with the match details on hover, linking to the match. -->
{#if href}
	<a {href} class={cn(interactive, 'inline-flex shrink-0', className)} {@attach tooltip(content)}>
		<Badge variant={won ? 'success' : 'destructive'}>{won ? t('W') : t('L')}</Badge>
	</a>
{:else}
	<span class={cn('inline-flex shrink-0', className)} {@attach tooltip(content)}>
		<Badge variant={won ? 'success' : 'destructive'}>{won ? t('W') : t('L')}</Badge>
	</span>
{/if}
