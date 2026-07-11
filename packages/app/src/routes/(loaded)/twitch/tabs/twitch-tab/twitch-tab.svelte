<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { cancel, onUrl, start, onInvalidUrl } from '@fabianlars/tauri-plugin-oauth';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { app } from '$core/app/context';
	import { Avatar } from 'bits-ui';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogo';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import SignOut from 'phosphor-svelte/lib/SignOut';
	import EnvelopeSimple from 'phosphor-svelte/lib/EnvelopeSimple';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
	import Clock from 'phosphor-svelte/lib/Clock';
	import { Checkbox } from '$lib/components/ui/input';
	import { twitch } from '$features/twitch';
	import dayjs from '$lib/dayjs';
	import { cn } from '$lib/utils';
	import { surfacePanel } from '$lib/components/ui/variants';
	import { tooltip } from '$lib/attachments';

	let isStartingOAuth = $state(false);

	const broadcasterTypeLabel = $derived.by(() => {
		const type = twitch.user?.broadcasterType;

		if (type === 'partner') return 'Partner';
		if (type === 'affiliate') return 'Affiliate';

		return null;
	});

	const initials = $derived.by(() => {
		const name = twitch.user?.displayName ?? twitch.token?.userName ?? '';

		return name.slice(0, 2).toUpperCase();
	});

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
			const hash = url.hash.substring(1);
			const params = new URLSearchParams(hash);

			const { access_token } = Object.fromEntries(params.entries());

			if (!access_token) {
				app.toast.error('Failed to get access token');
				return;
			}

			app.toast.success('Successfully connected to Twitch');
			twitch.settings.accessToken = access_token as string;

			cancel(port);
			isStartingOAuth = false;
		});

		onInvalidUrl(() => {
			app.toast.error('Twitch OAuth flow was cancelled or failed');
			isStartingOAuth = false;
		});
	};

	const disconnect = () => {
		twitch.settings.accessToken = null;
		app.toast.success('Successfully disconnected from Twitch');
	};

	const openTwitchProfile = () => {
		const userName = twitch.user?.name ?? twitch.token?.userName;

		if (userName) {
			openUrl(`https://www.twitch.tv/${userName}`);
		}
	};
</script>

<div class="mb-4 flex flex-col items-start gap-2">
	<Form.Root>
		<Form.Group>
			<Form.Label>Enable twitch integration</Form.Label>
			<Checkbox bind:checked={twitch.settings.enabled} label="Enabled" />
		</Form.Group>
		{#if twitch.settings.enabled}
			{#if twitch.token}
				<Form.Group>
					<Form.Label>Connected account</Form.Label>
					<div class={cn(surfacePanel, 'relative w-full max-w-xl overflow-hidden p-5')}>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={disconnect}
							type="button"
							class="text-destructive/70 hover:text-destructive absolute top-3 right-3 cursor-pointer"
							{@attach tooltip('Disconnect')}
						>
							<SignOut size="18" />
						</Button>
						<div class="relative flex items-start gap-4">
							<div class="relative shrink-0">
								<Avatar.Root
									class={cn(
										'size-16 rounded-full border-2',
										twitch.isLive ? 'border-success' : 'border-secondary-600'
									)}
								>
									<div
										class="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
									>
										<Avatar.Image
											src={twitch.user?.profilePictureUrl}
											alt={twitch.user?.displayName ?? twitch.token.userName ?? ''}
										/>
										<Avatar.Fallback
											class="bg-secondary-800 flex h-full w-full items-center justify-center text-sm font-semibold"
										>
											{initials}
										</Avatar.Fallback>
									</div>
								</Avatar.Root>
								<span
									class={cn(
										'border-secondary-900 absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-2',
										twitch.isLive ? 'bg-success' : 'bg-secondary-500'
									)}
								></span>
							</div>
							<div class="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
								<div class="flex flex-wrap items-center gap-2">
									<button
										type="button"
										class="hover:text-primary flex items-center gap-1 text-left font-semibold transition-colors"
										onclick={openTwitchProfile}
									>
										{twitch.user?.displayName ?? twitch.token.userName}
										<ArrowSquareOut size="14" />
									</button>
									<Badge variant={twitch.isLive ? 'success' : 'default'}>
										{twitch.isLive ? 'Live' : 'Offline'}
									</Badge>
									{#if broadcasterTypeLabel}
										<Badge variant="primary">{broadcasterTypeLabel}</Badge>
									{/if}
								</div>
								{#if twitch.user?.name}
									<span class="text-secondary-400 -mt-1 text-sm">@{twitch.user.name}</span>
								{/if}
								{#if twitch.user?.description}
									<p class="text-secondary-400 line-clamp-2 text-sm">{twitch.user.description}</p>
								{/if}
								<div
									class="text-secondary-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
								>
									{#if twitch.user?.email}
										<span class="flex items-center gap-1.5">
											<EnvelopeSimple size="14" />
											{twitch.user.email}
										</span>
									{/if}
									{#if twitch.user?.creationDate}
										<span class="flex items-center gap-1.5">
											<CalendarBlank size="14" />
											Joined {dayjs(twitch.user.creationDate).format('D MMM YYYY')}
										</span>
									{/if}
									{#if twitch.token.expiryDate}
										<span class="flex items-center gap-1.5">
											<Clock size="14" />
											Session expires {dayjs(twitch.token.expiryDate).format('D MMM YYYY HH:mm')}
										</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</Form.Group>
			{:else}
				<Form.Group>
					<Form.Label>Twitch Channel</Form.Label>
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
				</Form.Group>
			{/if}
		{/if}
	</Form.Root>
</div>
