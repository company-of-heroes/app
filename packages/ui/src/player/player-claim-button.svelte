<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import SteamLogoIcon from 'phosphor-svelte/lib/SteamLogo';
	import UserPlusIcon from 'phosphor-svelte/lib/UserPlusIcon';
	import { Button } from '../ui/button';
	import { Popover } from '../ui/popover';
	import { useHost } from '../host/host.context';

	type Props = {
		/** The unclaimed player's Steam ID. */
		steamId: string;
		/** Small text button for table rows (leaderboards); otherwise a regular button. */
		compact?: boolean;
		class?: string;
	};

	let { steamId, compact = false, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let open = $state(false);
	let pending = $state(false);

	const signedIn = $derived(!!host.auth.user);
	const href = $derived(host.routes.steamClaim?.());
	const claimInPlace = $derived(host.auth.claimSteam);
	/** Already one of the viewer's Steam ids (a list cached before the claim). */
	const own = $derived(host.auth.user?.steamIds.includes(steamId) ?? false);

	async function claim() {
		if (!claimInPlace) {
			return;
		}

		pending = true;
		try {
			const error = await claimInPlace();
			if (error) {
				host.notify.error(error);
			} else {
				open = false;
			}
		} finally {
			pending = false;
		}
	}
</script>

{#if !own && (href || claimInPlace)}
	<Popover bind:open side="bottom" align="start" contentClass="w-[20rem] max-w-[90vw] p-0">
		{#snippet trigger({ props })}
			{#if compact}
				<button
					type="button"
					{...props}
					class={cn(
						interactive,
						'text-secondary-400 hover:text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium',
						className
					)}
					aria-label={t('Claim this account')}
				>
					<UserPlusIcon size={14} />
					{t('Claim')}
				</button>
			{:else}
				<Button
					{...props}
					variant="secondary"
					size="sm"
					class={cn('shrink-0 bg-gray-950/60 backdrop-blur-sm', className)}
				>
					<UserPlusIcon size={16} />
					{t('Claim account')}
				</Button>
			{/if}
		{/snippet}
		<div class="border-secondary-800 border-b px-4 py-3">
			<p class="text-sm font-semibold text-white">{t('Is this your account?')}</p>
			<p class="text-secondary-300 mt-1 text-sm leading-relaxed">
				{#if signedIn}
					{t(
						'Sign in with the Steam account of this player to claim it. It is added to the Steam accounts of your account.'
					)}
				{:else}
					{t(
						'Sign in with the Steam account of this player to claim it. If you do not have an account yet, one is created for you.'
					)}
				{/if}
			</p>
		</div>
		<div class="px-4 py-3">
			{#if href}
				<Button {href} size="sm" class="w-full justify-center">
					<SteamLogoIcon size={16} weight="fill" />
					{t('Claim with Steam')}
				</Button>
			{:else}
				<Button
					type="button"
					size="sm"
					class="w-full justify-center"
					loading={pending}
					disabled={pending}
					onclick={claim}
				>
					<SteamLogoIcon size={16} weight="fill" />
					{t('Claim with Steam')}
				</Button>
			{/if}
		</div>
	</Popover>
{/if}
