<script lang="ts">
	import { provideHost, useHost, type HostContext } from '@company-of-heroes/ui/host';
	import { PlayerCard } from '@company-of-heroes/ui/supporter';
	import type { PlayerCardData } from '@company-of-heroes/ui/supporter/types';
	import I18nBoot from '$lib/components/i18n/i18n-boot.svelte';

	type Props = {
		card: PlayerCardData;
	};

	let { card }: Props = $props();

	// The shared PNG is always English (dates too), whatever the page's locale; set once at init.
	const host = useHost();
	provideHost(
		new Proxy(host, {
			get: (target, prop, receiver) =>
				prop === 'locale' ? () => 'en' : Reflect.get(target, prop, receiver)
		}) as HostContext
	);
</script>

<!-- The hidden copy of the card the 1200×630 share PNG is drawn from. -->
<I18nBoot locale="en">
	<PlayerCard
		{card}
		class="flex h-full flex-col [&>*]:shrink-0 [&>header]:shrink [&>header]:grow"
	/>
</I18nBoot>
