<script lang="ts">
	import type { Twitch } from '../twitch.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$lib/state/app.svelte';
	import { cancel, onUrl, start } from '@fabianlars/tauri-plugin-oauth';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { toast } from 'svelte-sonner';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogo';
	import ArrowIcon from 'phosphor-svelte/lib/ArrowRight';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils';

	let module = $derived(app.activeModules.get('twitch') as Twitch);
	let isStreamOnline = $state(false);

	onMount(() => {
		if (!module.user || !module.user.userId) {
			toast.error('Twitch user not found. Please connect your Twitch account.');
			return;
		}

		module.eventSub?.onStreamOnline(module.user.userId, () => (isStreamOnline = true));
		module.eventSub?.onStreamOffline(module.user.userId, () => (isStreamOnline = false));

		module.client?.streams.getStreamByUserId(module.user.userId).then((stream) => {
			if (stream) {
				isStreamOnline = true;
			} else {
				isStreamOnline = false;
			}
		});
	});

	const startOAuthFlow = async () => {
		cancel(8001);
		const port = await start({ ports: [8001, 8002, 8003, 8004, 8005] });
		const url = new URL('https://id.twitch.tv/oauth2/authorize');
		const state = Math.random().toString(36).substring(2, 15);

		console.log(`OAuth server listening on http://localhost:${port}`);

		url.searchParams.set('response_type', 'token');
		url.searchParams.set('redirect_uri', `http://localhost:${port}`);
		url.searchParams.set(
			'scope',
			'user:read:email chat:read chat:edit channel:read:redemptions channel:manage:redemptions'
		);
		url.searchParams.set('client_id', module.clientId);
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
			module.settings.accessToken = access_token as string;
			app.store.set('settings', app.settings);

			cancel(port);
		});
	};

	const disconnect = () => {
		module.settings.accessToken = undefined;
		app.store.set('settings', app.settings);
		toast.success('Successfully disconnected from Twitch');
	};
</script>

<div class="mb-4 flex flex-col items-start gap-2">
	<Label>Twitch Channel</Label>
	{#if module?.isConnected}
		<span class="flex items-center gap-2">
			<Button variant="destructive" onclick={disconnect} type="button">Disconnect</Button>
			<ArrowIcon size="20" />
			<Button
				variant="secondary"
				class="bg-secondary-900"
				onclick={() => openUrl(`https://www.twitch.tv/${module.user?.userName}`)}
			>
				<span
					class={cn(
						'me-2 h-2 w-2 rounded-full bg-red-500 ring-4 ring-red-500/30',
						isStreamOnline && 'bg-green-500 ring-green-500/30'
					)}
				></span>
				<span class="text-secondary-300">{module.user?.userName}</span>
			</Button>
		</span>
	{:else}
		<Button
			variant="secondary"
			type="button"
			onclick={startOAuthFlow}
			class="bg-[#6441a5] shadow-none"
		>
			<TwitchIcon size="22" weight="bold" />
			Connect Twitch
		</Button>
	{/if}
</div>
