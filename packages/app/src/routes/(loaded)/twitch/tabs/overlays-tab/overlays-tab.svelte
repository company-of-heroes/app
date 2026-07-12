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

	const overlay = twitchOverlays.overlays[0];
	let copied = $state(false);
	let publishing = $state(false);
	let hasUnpublishedChanges = $state(false);
	let checkingChanges = $state(false);

	const overlayUrl = $derived(
		app.features.auth.user?.id ? overlay.getHostedUrl(app.features.auth.user.id) : ''
	);

	async function refreshChangeState() {
		if (!app.features.auth.user) {
			hasUnpublishedChanges = false;
			return;
		}

		checkingChanges = true;
		try {
			hasUnpublishedChanges = await overlay.hasUnpublishedChanges();
		} catch (error) {
			console.warn('[OVERLAYS-TAB]: failed to check overlay changes:', error);
			hasUnpublishedChanges = false;
		} finally {
			checkingChanges = false;
		}
	}

	watch(
		() => app.features.auth.user?.id,
		(userId) => {
			if (!userId) {
				hasUnpublishedChanges = false;
				return;
			}

			void refreshChangeState();
		}
	);

	$effect(() => {
		if (!app.features.auth.user) return;

		const onFocus = () => {
			void refreshChangeState();
		};

		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	});

	function copyToClipboard() {
		if (!overlayUrl) return;
		navigator.clipboard.writeText(overlayUrl);
		copied = true;
		app.toast.success('Overlay URL copied to clipboard!');
		setTimeout(() => {
			copied = false;
		}, 5000);
	}

	async function openInEditor() {
		try {
			await openPath(await overlay.getPath());
		} catch (error) {
			console.error('Failed to open overlay folder:', error);
			app.toast.error('Could not open overlay folder in your editor.');
		}
	}

	async function publishChanges() {
		if (publishing) return;
		publishing = true;
		try {
			await overlay.publish();
			hasUnpublishedChanges = false;
			app.toast.success('Overlay changes published to server.');
		} catch (error) {
			console.error('Failed to publish overlay:', error);
			app.toast.error('Failed to publish overlay changes. Check your connection and try again.');
		} finally {
			publishing = false;
		}
	}
</script>

<Form.Root>
	<Form.Group>
		<Form.Label for="overlay-url">Overlay URL</Form.Label>
		<Form.Description>
			Use this URL in your streaming software to add the Opponent Bot overlay to your stream.
		</Form.Description>
		<div class="relative flex">
			<Input
				id="overlay-url"
				readonly
				value={overlayUrl}
				placeholder="Log in to generate your overlay URL"
				class={cn(copied && 'border-success bg-success/5')}
			/>
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				class={cn(
					'text-secondary-400 absolute top-1.5 right-1.5',
					copied && 'text-success pointer-events-none'
				)}
				onclick={copyToClipboard}
				disabled={!overlayUrl}
				title="Copy Overlay URL"
			>
				{#if copied}
					<CheckIcon size={20} />
				{:else}
					<CopyIcon size={20} />
				{/if}
			</Button>
		</div>
	</Form.Group>
</Form.Root>

<div class="mt-4 flex flex-wrap gap-2">
	<Button type="button" variant="secondary" onclick={openInEditor}>
		<FolderOpenIcon size={18} />
		Open in editor
	</Button>
	<Button
		type="button"
		onclick={publishChanges}
		disabled={publishing || checkingChanges || !hasUnpublishedChanges || !app.features.auth.user}
	>
		<CloudArrowUpIcon size={18} />
		{publishing ? 'Publishing…' : 'Publish changes to server'}
	</Button>
</div>

<p class="text-secondary-400 mt-4 max-w-2xl text-sm">
	Your overlay is hosted automatically at the URL above. Open it in your code editor only when you
	want to customize it, then use “Publish changes to server” to update the live version.
</p>
