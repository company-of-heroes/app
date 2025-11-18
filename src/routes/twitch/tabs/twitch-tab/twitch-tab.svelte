<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { cancel, onUrl, start, onInvalidUrl } from '@fabianlars/tauri-plugin-oauth';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { toast } from 'svelte-sonner';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogo';
	import ArrowIcon from 'phosphor-svelte/lib/ArrowRight';
	import { cn } from '$lib/utils';
	import { Checkbox, Input } from '$lib/components/ui/input';
	import { twitch } from '$plugins/twitch';

	let isStreamOnline = $state(false);
	let isStartingOAuth = $state(false);

	const startOAuthFlow = async () => {
		isStartingOAuth = true;
		cancel(8001);
		const port = await start({ ports: [8001, 8002, 8003, 8004, 8005] });
		const url = new URL('https://id.twitch.tv/oauth2/authorize');
		const state = Math.random().toString(36).substring(2, 15);

		console.log(`OAuth server listening on http://localhost:${port}`);

		url.searchParams.set('response_type', 'token');
		url.searchParams.set('redirect_uri', `http://localhost:${port}`);
		url.searchParams.set(
			'scope',
			'user:read:email chat:read chat:edit channel:read:redemptions channel:manage:redemptions channel:manage:predictions channel:read:predictions'
		);
		url.searchParams.set('client_id', twitch.settings.clientId);
		url.searchParams.set('state', state);

		openUrl(url.toString());

		onUrl((u) => {
			const url = new URL(u);
			const hash = url.hash.substring(1); // remove the '#'
			const params = new URLSearchParams(hash);

			const { access_token } = Object.fromEntries(params.entries());

			if (!access_token) {
				toast.error('Failed to get access token');
				return;
			}

			toast.success('Successfully connected to Twitch');
			twitch.settings.accessToken = access_token as string;

			cancel(port);
			isStartingOAuth = false;
		});

		onInvalidUrl(() => {
			toast.error('Twitch OAuth flow was cancelled or failed');
			isStartingOAuth = false;
		});
	};

	const disconnect = () => {
		twitch.settings.accessToken = null;
		toast.success('Successfully disconnected from Twitch');
	};
</script>

<div class="mb-4 flex flex-col items-start gap-2">
	<div class="mb-4 flex flex-col gap-2">
		<Label>Enable twitch integration</Label>
		<Checkbox bind:checked={twitch.settings.enabled} label="Enabled" />
	</div>
	<div class="mb-4 flex w-full flex-col gap-2">
		<Label>Twitch Client ID</Label>
		<Input
			type="text"
			bind:value={twitch.settings.clientId}
			placeholder="Enter your Twitch Client ID"
			disabled={!twitch.settings.enabled}
		/>
	</div>
	{#if twitch.settings.enabled}
		{#if twitch.token}
			<span class="flex items-center gap-2">
				<Button variant="destructive" onclick={disconnect} type="button">Disconnect</Button>
				<ArrowIcon size="20" />
				<Button
					variant="secondary"
					class="bg-secondary-900"
					onclick={() => openUrl(`https://www.twitch.tv/${twitch.token!.userId}`)}
				>
					<span
						class={cn(
							'me-2 h-2 w-2 rounded-full bg-red-500 ring-4 ring-red-500/30',
							isStreamOnline && 'bg-green-500 ring-green-500/30'
						)}
					></span>
					<span class="text-secondary-300">{twitch.token.userName}</span>
				</Button>
			</span>
		{:else}
			<Label>Twitch Channel</Label>
			<Button
				variant="secondary"
				type="button"
				onclick={startOAuthFlow}
				class="bg-[#6441a5] shadow-none"
				loading={isStartingOAuth}
			>
				<TwitchIcon size="22" weight="bold" />
				Connect Twitch
			</Button>
		{/if}
	{/if}
</div>
