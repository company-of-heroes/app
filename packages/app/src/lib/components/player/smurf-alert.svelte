<script lang="ts">
	import type { SmurfAlertState } from '$lib/player/smurf';
	import { interactive } from '$lib/components/ui/variants';
	import { resolve } from '$app/paths';
	import { PlayerProfileLink, playerPreviewId } from '@company-of-heroes/ui/player';
	import { cn } from '$lib/utils';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import BinocularsIcon from 'phosphor-svelte/lib/BinocularsIcon';
	import { useI18n } from '$lib/i18n';

	type Props = {
		smurf: SmurfAlertState;
		compact?: boolean;
	};

	let { smurf, compact = false }: Props = $props();
	const { t } = useI18n();

	const lenderId = $derived(
		smurf.status === 'shared'
			? String(smurf.lenderProfile?.profile_id ?? smurf.lenderSteamId)
			: undefined
	);

	const lenderLabel = $derived(
		smurf.status === 'shared' && smurf.lenderProfile
			? smurf.lenderProfile.alias
			: smurf.status === 'shared' && smurf.lenderSteam
				? smurf.lenderSteam.personaname
				: t('Original account')
	);

	const lenderAvatar = $derived(
		smurf.status === 'shared' ? smurf.lenderSteam?.avatarfull : undefined
	);

	const previewId = $derived(
		smurf.status === 'shared'
			? (playerPreviewId({
					steamId: smurf.lenderSteamId,
					profileId: smurf.lenderProfile?.profile_id ?? null
				}) ?? lenderId)
			: undefined
	);

	const lenderHref = $derived(
		lenderId ? resolve('/(loaded)/players/[id]', { id: lenderId }) : undefined
	);
</script>

{#if smurf.status === 'shared' && lenderId && lenderHref && previewId}
	{#if compact}
		<PlayerProfileLink
			href={lenderHref}
			playerId={previewId}
			class={cn(
				interactive,
				'text-destructive inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold tracking-wide uppercase hover:underline'
			)}
			title={t('Smurf · {name}', { name: lenderLabel })}
		>
			<BinocularsIcon class="shrink-0" size={12} weight="bold" />
			{t('Smurf')}
		</PlayerProfileLink>
	{:else}
		<div class="text-destructive inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
			<BinocularsIcon class="shrink-0" size={16} weight="bold" />
			<span>{t('Smurf account')}</span>
			<PlayerProfileLink
				href={lenderHref}
				playerId={previewId}
				class={cn(interactive, 'inline-flex items-center gap-1.5 hover:underline')}
			>
				{#if lenderAvatar}
					<img src={lenderAvatar} alt="" class="size-5 rounded-sm object-cover" />
				{/if}
				<span>{lenderLabel}</span>
				<ArrowRightIcon size={12} weight="bold" />
			</PlayerProfileLink>
		</div>
	{/if}
{/if}
