<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';

	type Props = HTMLAttributes<HTMLImageElement>;

	const { ...restProps }: Props = $props();
	const countryName = $derived.by(() => {
		if (!player.profile) {
			return 'Unknown';
		}

		const region = String(player.profile.country).toUpperCase();

		const dn = new Intl.DisplayNames(['en'], { type: 'region' });
		const countryName = dn.of(region);

		return countryName || 'Unknown';
	});
	const { player } = usePlayer();
</script>

{#if player.profile}
	<div
		class="ring-secondary-800 h-5 w-5 rounded-full bg-size-[48px] bg-center bg-no-repeat ring-4"
		style="background-image: url('https://flagsapi.com/{upperCase(
			player.profile.country
		)}/flat/64.png');"
		{@attach tooltip(countryName)}
	></div>
{/if}
