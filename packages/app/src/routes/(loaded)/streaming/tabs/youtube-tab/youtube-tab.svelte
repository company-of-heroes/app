<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/input';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { Avatar } from 'bits-ui';
	import YoutubeLogoIcon from 'phosphor-svelte/lib/YoutubeLogoIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
	import { app } from '$core/app/context';
	import { youtube } from '$features/youtube';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { tooltip } from '$lib/attachments';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const initials = $derived((youtube.channel?.title ?? '').slice(0, 2).toUpperCase());

	const connect = async () => {
		try {
			const connected = await youtube.connect();
			if (connected) {
				app.toast.success(t('Successfully connected to YouTube'));
			} else {
				app.toast.error(t('YouTube sign-in was cancelled or failed'));
			}
		} catch (err) {
			console.error('[YOUTUBE]: connect failed:', err);
			app.toast.error(t('YouTube sign-in was cancelled or failed'));
		}
	};

	const disconnect = () => {
		youtube.disconnect();
		app.toast.success(t('Successfully disconnected from YouTube'));
	};

	const openChannel = () => {
		if (youtube.channelUrl) {
			void openUrl(youtube.channelUrl);
		}
	};
</script>

<Form.Root>
	<Form.Group
		label={t('Enable YouTube integration')}
		description={t('Read your YouTube Live chat for TTS and let the bot post to it.')}
	>
		<Checkbox bind:checked={youtube.settings.enabled} label={t('Enabled')} />
	</Form.Group>
	{#if youtube.settings.enabled}
		{#if youtube.channel}
			<Form.Group label={t('Connected account')}>
				<div class="relative flex w-full min-w-0 items-start gap-4">
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={disconnect}
						type="button"
						class="text-destructive/70 hover:text-destructive absolute top-3 right-3"
						{@attach tooltip(t('Disconnect'))}
					>
						<SignOutIcon size="18" />
					</Button>
					<Avatar.Root
						class={cn(
							'size-16 shrink-0 rounded-full border-2',
							youtube.isLive ? 'border-success' : 'border-secondary-600'
						)}
					>
						<div
							class="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
						>
							<Avatar.Image src={youtube.channel.thumbnailUrl} alt={youtube.channel.title} />
							<Avatar.Fallback
								class="bg-secondary-800 flex h-full w-full items-center justify-center text-sm font-semibold"
							>
								{initials}
							</Avatar.Fallback>
						</div>
					</Avatar.Root>
					<div class="flex min-w-0 flex-1 flex-col gap-2 pe-10">
						<div class="flex flex-wrap items-center gap-2">
							<button
								type="button"
								class={cn(
									interactive,
									'hover:text-primary flex items-center gap-1 text-left font-semibold transition-colors'
								)}
								onclick={openChannel}
							>
								{youtube.channel.title}
								<ArrowSquareOutIcon size="14" />
							</button>
							<Badge variant={youtube.isLive ? 'success' : 'default'}>
								{youtube.isLive ? t('Live') : t('Offline')}
							</Badge>
						</div>
						{#if youtube.channel.customUrl}
							<span class="text-secondary-400 -mt-1 text-sm">{youtube.channel.customUrl}</span>
						{/if}
					</div>
				</div>
			</Form.Group>
		{:else}
			<Form.Group label={t('YouTube Channel')}>
				<Button
					variant="secondary"
					type="button"
					onclick={connect}
					class="w-fit bg-[#cc0000] shadow-none"
					loading={youtube.isConnecting}
				>
					<YoutubeLogoIcon size="18" weight="bold" />
					{t('Connect YouTube')}
				</Button>
			</Form.Group>
		{/if}
	{/if}
</Form.Root>
