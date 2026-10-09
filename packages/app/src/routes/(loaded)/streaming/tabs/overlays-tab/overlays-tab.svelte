<script lang="ts">
	import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import CloudArrowUpIcon from 'phosphor-svelte/lib/CloudArrowUpIcon';
	import { openPath } from '@tauri-apps/plugin-opener';
	import { twitchOverlays } from '$features/twitch-overlays';
	import { cn } from '$lib/utils';
	import { watch } from 'runed';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Form from '$lib/components/ui/form';
	import { useI18n } from '$lib/i18n';
	import { tooltip } from '$lib/attachments';

	const overlay = twitchOverlays.overlays[0];
	const { t } = useI18n();
	let copied = $state(false);
	let publishing = $state(false);
	let hasUnpublishedChanges = $state(false);
	let checkingChanges = $state(false);
	let hasDistBuild = $state(false);
	let distStale = $state(false);

	const overlayUrl = $derived(
		app.features.auth.user?.id ? overlay.getHostedUrl(app.features.auth.user.id) : ''
	);

	const canPublish = $derived(
		hasDistBuild &&
			hasUnpublishedChanges &&
			!distStale &&
			!publishing &&
			!checkingChanges &&
			!!app.features.auth.user
	);

	async function refreshChangeState() {
		if (!app.features.auth.user) {
			hasUnpublishedChanges = false;
			hasDistBuild = false;
			distStale = false;
			return;
		}

		checkingChanges = true;
		try {
			[hasUnpublishedChanges, hasDistBuild, distStale] = await Promise.all([
				overlay.hasUnpublishedChanges(),
				overlay.hasDistBuild(),
				overlay.isDistStale()
			]);
		} catch (error) {
			console.warn('[OVERLAYS-TAB]: failed to check overlay changes:', error);
			hasUnpublishedChanges = false;
			hasDistBuild = false;
			distStale = false;
		} finally {
			checkingChanges = false;
		}
	}

	watch(
		() => app.features.auth.user?.id,
		(userId) => {
			if (!userId) {
				hasUnpublishedChanges = false;
				hasDistBuild = false;
				distStale = false;
				return;
			}

			void refreshChangeState();
		}
	);

	$effect(() => {
		if (!app.features.auth.user) {
			return;
		}

		const onFocus = () => {
			void refreshChangeState();
		};

		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	});

	function copyToClipboard() {
		if (!overlayUrl) {
			return;
		}

		navigator.clipboard.writeText(overlayUrl);
		copied = true;
		app.toast.success(t('Overlay URL copied to clipboard!'));
		setTimeout(() => {
			copied = false;
		}, 5000);
	}

	async function openInEditor() {
		try {
			await openPath(await overlay.getPath());
		} catch (error) {
			console.error('Failed to open overlay folder:', error);
			app.toast.error(t('Could not open overlay folder in your editor.'));
		}
	}

	async function publishChanges() {
		if (publishing || !canPublish) {
			return;
		}

		publishing = true;
		try {
			await overlay.publish();
			await refreshChangeState();
			app.toast.success(t('Overlay changes published to server.'));
		} catch (error) {
			console.error('Failed to publish overlay:', error);
			const message =
				error instanceof Error ? error.message : t('Failed to publish overlay changes.');
			app.toast.error(message);
		} finally {
			publishing = false;
		}
	}
</script>

<Form.Root>
	<Form.Group
		inputId="overlay-url"
		label={t('Overlay URL')}
		description={t(
			'Use this URL in your streaming software to add the Opponent Bot overlay to your stream.'
		)}
	>
		<Input
			id="overlay-url"
			readonly
			value={overlayUrl}
			placeholder={t('Log in to generate your overlay URL')}
			class={cn(copied && 'text-success')}
		/>
		<Button
			variant="secondary"
			type="button"
			class="w-fit shrink-0"
			onclick={copyToClipboard}
			disabled={!overlayUrl}
			{@attach tooltip(t('Copy Overlay URL'))}
		>
			{#if copied}
				<CheckIcon size={16} />
			{:else}
				<CopyIcon size={16} />
			{/if}
			{t('Copy')}
		</Button>
	</Form.Group>
</Form.Root>

<Form.Group>
	<Button type="button" variant="secondary" class="w-fit" onclick={openInEditor}>
		<FolderOpenIcon size={16} />
		{t('Open in editor')}
	</Button>
	<Button type="button" class="w-fit" onclick={publishChanges} disabled={!canPublish}>
		<CloudArrowUpIcon size={16} />
		{publishing ? t('Publishing…') : t('Publish changes to server')}
	</Button>
</Form.Group>

<div class="text-secondary-400 max-w-2xl space-y-2 p-4 text-sm">
	<p>
		{t(
			'Your overlay is hosted at the URL above. To customize it, open the overlay folder, edit files in src/, then build and publish:'
		)}
	</p>
	<ol class="list-decimal space-y-1 pl-5">
		<li>{t('Run npm install once (requires Node.js)')}</li>
		<li>
			{t(
				'Preview with test lobbies: npm run dev, then open http://localhost:5173 (1v1–4v4 buttons appear bottom-right)'
			)}
		</li>
		<li>{t('Edit Svelte/CSS in src/')}</li>
		<li>
			{t('Run npm run build in the overlay folder (via “Open in editor”) to update dist/')}
		</li>
		<li>{t('Click “Publish changes to server” to update the live overlay')}</li>
	</ol>
	{#if !hasDistBuild && app.features.auth.user}
		<p class="text-warning">
			{t('No build found. Run npm run build in the overlay folder before publishing.')}
		</p>
	{:else if distStale}
		<p class="text-warning">
			{t('Source files are newer than dist/. Run npm run build before publishing.')}
		</p>
	{/if}
</div>
