<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { escapeHtml, tooltip } from '../attachments';
	import { countryDisplayName } from '../format/country';
	import { useHost } from '../host/host.context';

	type Props = {
		/** ISO 3166-1 alpha-2 code from Relic; nothing renders without a known flag. */
		country: string | null | undefined;
		class?: string;
	};

	const host = useHost();

	let { country, class: className }: Props = $props();

	const src = $derived(host.resolve.flagImageUrl(country));
	const name = $derived(countryDisplayName(country, host.locale()) ?? country?.toUpperCase() ?? '');
</script>

<!-- A player's country flag; hover shows the country name in the viewer's language. -->
{#if src}
	<img
		{src}
		alt={name}
		loading="lazy"
		decoding="async"
		class={cn('h-3 w-auto shrink-0 rounded-xs', className)}
		{@attach tooltip(escapeHtml(name))}
	/>
{/if}
