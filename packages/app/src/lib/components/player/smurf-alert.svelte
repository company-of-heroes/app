<script lang="ts">
	import type { SmurfAlertState } from '$lib/player/smurf';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';
	import LinkSimpleIcon from 'phosphor-svelte/lib/LinkSimple';

	type Props = {
		smurf: SmurfAlertState;
	};

	let { smurf }: Props = $props();

	const lenderHref = $derived(
		smurf.status === 'shared'
			? `/players/${smurf.lenderProfile?.profile_id ?? smurf.lenderSteamId}`
			: undefined
	);

	const lenderLabel = $derived(
		smurf.status === 'shared' && smurf.lenderProfile
			? smurf.lenderProfile.alias
			: smurf.status === 'shared' && smurf.lenderSteam
				? smurf.lenderSteam.personaname
				: 'Original account'
	);

	const lenderAvatar = $derived(
		smurf.status === 'shared' ? smurf.lenderSteam?.avatarfull : undefined
	);
</script>

{#if smurf.status === 'shared' && lenderHref}
	<div
		class="border-warning/20 bg-warning/5 text-secondary-400 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-sm"
	>
		<LinkSimpleIcon class="text-warning/70 shrink-0" size={14} weight="bold" />
		<span>Shared account</span>
		<span class="text-secondary-600">·</span>
		<a
			href={lenderHref}
			class="text-secondary-200 hover:text-primary inline-flex items-center gap-1.5 transition-colors"
		>
			{#if lenderAvatar}
				<img src={lenderAvatar} alt="" class="size-5 rounded-sm object-cover" />
			{/if}
			<span class="font-medium">{lenderLabel}</span>
			<ArrowRightIcon size={12} weight="bold" />
		</a>
	</div>
{/if}
