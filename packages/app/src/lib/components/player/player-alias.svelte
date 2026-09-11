<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import PlayerLabels from './player-labels.svelte';
	import PlayerLikeCount from './player-like-count.svelte';
	import { PlayerProfileLink, playerPreviewId } from '@company-of-heroes/ui/player';
	import { cn } from '$lib/utils';
	import { isMePlayer } from '$lib/utils/player-me';
	import { mePlayerText } from '$lib/components/ui/variants';
	import { useI18n } from '$lib/i18n';

	type Props = HTMLAnchorAttributes;

	const { class: className, href, ...restProps }: Props = $props();
	const { t } = useI18n();
	const { player } = $derived(usePlayer());
	const isMe = $derived(isMePlayer(player));
	const profileHref = $derived(href ?? `/players/${player.playerId}`);
	const previewId = $derived(
		playerPreviewId({
			steamId: player.steamId,
			profileId: player.playerId > 0 ? player.playerId : null
		}) ?? (player.playerId > 0 ? String(player.playerId) : '')
	);
</script>

<span class={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
	<PlayerLikeCount steamId={player.steamId} class="shrink-0" />
	{#if previewId}
		<PlayerProfileLink
			{...restProps}
			href={profileHref}
			playerId={previewId}
			class={cn('hover:text-primary min-w-0 truncate transition-colors', isMe && mePlayerText)}
		>
			{player.profile?.alias ?? player.name ?? t('CPU')}
		</PlayerProfileLink>
	{:else}
		<a
			{...restProps}
			class={cn('hover:text-primary min-w-0 truncate transition-colors', isMe && mePlayerText)}
			href={profileHref}
		>
			{player.profile?.alias ?? player.name ?? t('CPU')}
		</a>
	{/if}
	<PlayerLabels steamId={player.steamId} class="shrink-0" />
</span>
