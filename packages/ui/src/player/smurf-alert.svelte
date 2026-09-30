<script lang="ts" module>
	export type PlayerSmurf = {
		lenderSteamId: string;
		lenderProfileId: number | null;
		lenderAlias: string;
		lenderAvatarUrl: string | null;
	};
</script>

<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import BinocularsIcon from 'phosphor-svelte/lib/BinocularsIcon';
	import { useHost } from '../host/host.context';
	import PlayerProfileLink from './player-profile-link.svelte';
	import PlayerStreamerIcon from './player-streamer-icon.svelte';
	import { playerPreviewId } from './player-preview-cache';

	type Props = {
		smurf: PlayerSmurf;
		/** Hide the "Smurf account" prefix (e.g. when a list title already says it). */
		showLabel?: boolean;
		/** Small badge for lobby rows. */
		compact?: boolean;
	};

	let { smurf, showLabel = true, compact = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const lenderHref = $derived(host.routes.player(smurf.lenderProfileId ?? smurf.lenderSteamId));
	const lenderAvatar = $derived(
		smurf.lenderAvatarUrl ? host.resolve.avatarUrl(smurf.lenderAvatarUrl) : null
	);
	const previewId = $derived(
		playerPreviewId({ steamId: smurf.lenderSteamId, profileId: smurf.lenderProfileId }) ??
			smurf.lenderSteamId
	);
</script>

{#if compact}
	<PlayerProfileLink
		href={lenderHref}
		playerId={previewId}
		class={cn(
			interactive,
			'text-destructive inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold tracking-wide uppercase hover:underline'
		)}
		title={t('Smurf · {name}', { name: smurf.lenderAlias })}
	>
		<BinocularsIcon class="shrink-0" size={12} weight="bold" />
		{t('Smurf')}
	</PlayerProfileLink>
{:else}
	<span
		class="text-destructive inline-flex h-5 items-center gap-x-1.5 text-sm leading-none font-bold"
	>
		{#if showLabel}
			<BinocularsIcon class="shrink-0" size={16} weight="bold" />
			<span class="leading-none">{t('Smurf account')}</span>
		{/if}
		<PlayerProfileLink
			href={lenderHref}
			playerId={previewId}
			class={cn(interactive, 'inline-flex h-5 items-center gap-1.5 leading-none hover:underline')}
		>
			{#if lenderAvatar}
				<img src={lenderAvatar} alt="" class="block size-4 shrink-0 rounded-sm object-cover" />
			{/if}
			<PlayerStreamerIcon steamId={smurf.lenderSteamId} size={14} />
			<span class="leading-none">{smurf.lenderAlias}</span>
			<ArrowRightIcon class="shrink-0" size={12} weight="bold" />
		</PlayerProfileLink>
	</span>
{/if}
