<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource, watch } from 'runed';
	import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import * as Form from '../ui/form';
	import { Input, Textarea } from '../ui/input';
	import {
		PROFILE_BACKGROUND_MAX_BYTES,
		PROFILE_BIO_MAX,
		PROFILE_OTHER_LINKS_MAX,
		splitProfileLinks
	} from './profile';

	const { t } = useI18n();
	const host = useHost();

	const steamId = $derived(host.api.profile.steamId());
	const customization = resource(
		() => steamId,
		(id) => (id ? host.api.profile.get(id) : Promise.resolve(null))
	);

	let bio = $state('');
	let twitchUrl = $state('');
	let youtubeUrl = $state('');
	let otherLinks = $state<Array<{ id: string; label: string; url: string }>>([]);
	let clearBackground = $state(false);
	let backgroundFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement>();

	const canAddOtherLink = $derived(otherLinks.length < PROFILE_OTHER_LINKS_MAX);
	const backgroundPreview = $derived(
		clearBackground ? null : (previewUrl ?? customization.current?.backgroundUrl ?? null)
	);
	const showClearBackground = $derived(
		Boolean(backgroundFile || customization.current?.backgroundUrl)
	);

	watch(
		() => customization.current,
		(value) => {
			if (!value) {
				return;
			}

			const links = splitProfileLinks(value.links);
			bio = value.bio ?? '';
			twitchUrl = links.twitchUrl;
			youtubeUrl = links.youtubeUrl;
			otherLinks = links.others.map((link) => ({
				id: crypto.randomUUID(),
				label: link.label ?? '',
				url: link.url ?? ''
			}));
			clearBackground = false;
		}
	);

	function setPreview(file: File | null) {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}

		backgroundFile = file;
		previewUrl = file ? URL.createObjectURL(file) : null;
	}

	function onFileChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
		if (file && file.size > PROFILE_BACKGROUND_MAX_BYTES) {
			saveError = t('Background must be 5 MB or smaller.');
			return;
		}

		saveError = null;
		setPreview(file);
		clearBackground = false;
	}

	function clearBackgroundImage() {
		clearBackground = true;
		setPreview(null);
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function updateOtherLink(index: number, field: 'label' | 'url', value: string) {
		otherLinks = otherLinks.map((link, i) => (i === index ? { ...link, [field]: value } : link));
	}

	async function save() {
		if (!steamId || saving) {
			return;
		}

		saving = true;
		saveError = null;
		try {
			const next = await host.api.profile.save({
				steamId,
				bio,
				links: { twitchUrl, youtubeUrl, others: otherLinks },
				background: backgroundFile,
				clearBackground
			});
			customization.mutate(next);
			setPreview(null);
			clearBackground = false;
			if (fileInput) {
				fileInput.value = '';
			}

			host.notify.success(t('Profile updated.'));
		} catch (error) {
			saveError = error instanceof Error ? t(error.message) : t('Failed to save profile.');
		} finally {
			saving = false;
		}
	}
</script>

{#if !steamId}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Link your Steam account to customize your player profile.')}
	</p>
{:else if customization.loading && !customization.current}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Loading...')}
	</p>
{:else if customization.error}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Failed to load profile customization.')}
	</p>
{:else}
	<Form.Root>
		<Form.Group label={t('Bio')} inputId="profile-bio" description={t('Up to 500 characters.')}>
			<Textarea id="profile-bio" rows={4} maxlength={PROFILE_BIO_MAX} bind:value={bio} />
		</Form.Group>

		<Form.Group label={t('Twitch URL')} inputId="profile-twitch">
			<Input id="profile-twitch" type="url" bind:value={twitchUrl} />
		</Form.Group>

		<Form.Group label={t('YouTube URL')} inputId="profile-youtube">
			<Input id="profile-youtube" type="url" bind:value={youtubeUrl} />
		</Form.Group>

		<Form.Group
			label={t('Other links')}
			description={t('Up to 4 additional links.')}
			wide
			layout="stacked"
		>
			{#each otherLinks as link, index (link.id)}
				<div class="flex flex-col gap-2 sm:flex-row sm:items-end">
					<div class="min-w-0 flex-1">
						<label class="text-secondary-400 mb-1 block text-xs" for={`other-label-${link.id}`}>
							{t('Label')}
						</label>
						<Input
							id={`other-label-${link.id}`}
							value={link.label}
							maxlength={40}
							oninput={(event) =>
								updateOtherLink(index, 'label', (event.currentTarget as HTMLInputElement).value)}
						/>
					</div>
					<div class="min-w-0 flex-[2]">
						<label class="text-secondary-400 mb-1 block text-xs" for={`other-url-${link.id}`}>
							{t('URL')}
						</label>
						<Input
							id={`other-url-${link.id}`}
							type="url"
							value={link.url}
							oninput={(event) =>
								updateOtherLink(index, 'url', (event.currentTarget as HTMLInputElement).value)}
						/>
					</div>
					<Button
						type="button"
						variant="secondary"
						onclick={() => (otherLinks = otherLinks.filter((_, i) => i !== index))}
					>
						{t('Remove')}
					</Button>
				</div>
			{/each}
			{#if canAddOtherLink}
				<div>
					<Button
						type="button"
						variant="secondary"
						onclick={() =>
							(otherLinks = [...otherLinks, { id: crypto.randomUUID(), label: '', url: '' }])}
					>
						{t('Add link')}
					</Button>
				</div>
			{/if}
		</Form.Group>

		<Form.Group label={t('Background')} description={t('JPEG, PNG, or WebP. Max 5 MB.')}>
			{#if backgroundPreview}
				<img
					src={backgroundPreview}
					alt={t('Background')}
					class="mb-3 max-h-40 w-full max-w-md rounded-md object-cover"
				/>
			{:else}
				<div
					class="bg-secondary-950 text-secondary-400 mb-3 flex h-24 max-w-md items-center justify-center rounded-md text-xs"
				>
					{t('No background')}
				</div>
			{/if}
			{#snippet footer()}
				<div class="flex flex-wrap items-center gap-2">
					<input
						bind:this={fileInput}
						type="file"
						accept="image/jpeg,image/jpg,image/png,image/webp"
						class="hidden"
						onchange={onFileChange}
					/>
					<Button
						variant="secondary"
						type="button"
						class="w-fit"
						onclick={() => fileInput?.click()}
					>
						<ImageIcon size={16} />
						{t('Select image')}
					</Button>
					{#if showClearBackground && !clearBackground}
						<Button variant="secondary" type="button" onclick={clearBackgroundImage}>
							{t('Clear background')}
						</Button>
					{/if}
				</div>
			{/snippet}
		</Form.Group>

		<Form.Group>
			{#snippet footer()}
				<div class="flex flex-wrap items-center gap-3">
					<Button type="button" loading={saving} disabled={saving} onclick={() => void save()}>
						{t('Save profile')}
					</Button>
					{#if saveError}
						<p class="text-destructive text-sm">{saveError}</p>
					{/if}
				</div>
			{/snippet}
		</Form.Group>
	</Form.Root>
{/if}
