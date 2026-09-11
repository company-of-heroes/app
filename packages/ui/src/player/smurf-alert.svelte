<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import BinocularsIcon from 'phosphor-svelte/lib/BinocularsIcon';
	import PlayerProfileLink from './player-profile-link.svelte';
	import { playerPreviewId } from './player-preview-cache';

	export type PlayerSmurf = {
		lenderSteamId: string;
		lenderProfileId: number | null;
		lenderAlias: string;
		lenderAvatarUrl: string | null;
	};

	type Props = {
		smurf: PlayerSmurf;
		lenderHref: string;
		resolveAvatarUrl?: (url: string) => string;
		showLabel?: boolean;
		label?: string;
	};

	let {
		smurf,
		lenderHref,
		resolveAvatarUrl = (url) => url,
		showLabel = true,
		label = 'Smurf account'
	}: Props = $props();

	const lenderAvatar = $derived(
		smurf.lenderAvatarUrl ? resolveAvatarUrl(smurf.lenderAvatarUrl) : null
	);
	const previewId = $derived(
		playerPreviewId({
			steamId: smurf.lenderSteamId,
			profileId: smurf.lenderProfileId
		}) ?? smurf.lenderSteamId
	);
</script>

<span
	class="text-destructive inline-flex h-5 items-center gap-x-1.5 text-sm font-bold leading-none"
>
	{#if showLabel}
		<BinocularsIcon class="shrink-0" size={16} weight="bold" />
		<span class="leading-none">{label}</span>
	{/if}
	<PlayerProfileLink
		href={lenderHref}
		playerId={previewId}
		class={cn(interactive, 'inline-flex h-5 items-center gap-1.5 leading-none hover:underline')}
	>
		{#if lenderAvatar}
			<img src={lenderAvatar} alt="" class="block size-4 shrink-0 rounded-sm object-cover" />
		{/if}
		<span class="leading-none">{smurf.lenderAlias}</span>
		<ArrowRightIcon class="shrink-0" size={12} weight="bold" />
	</PlayerProfileLink>
</span>
