<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Input, Textarea } from '$lib/components/ui/input';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { flushHeader, flushHeaderDescription } from '$lib/components/ui/variants';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { basename } from '@tauri-apps/api/path';
	import { useI18n } from '$lib/i18n';
	import { api, unwrapApi } from '$core/api';
	import { resource, watch } from 'runed';
	import {
		PROFILE_BIO_MAX,
		PROFILE_OTHER_LINKS_MAX,
		buildProfileLinks,
		pickOwnedSteamId,
		splitProfileLinks
	} from '@company-of-heroes/api';
	import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
	import { page } from '$app/state';

	const { t } = useI18n();

	let bio = $state('');
	let twitchUrl = $state('');
	let youtubeUrl = $state('');
	let otherLinks = $state<Array<{ id: string; label: string; url: string }>>([]);
	let clearBackground = $state(false);
	let backgroundFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);

	const steamId = $derived(
		pickOwnedSteamId(app.features.auth.user.steamIds, [
			page.url.searchParams.get('steamId'),
			app.game.profile?.steam.steamid
		])
	);
	const canAddOtherLink = $derived(otherLinks.length < PROFILE_OTHER_LINKS_MAX);

	const customization = resource(
		() => steamId,
		async (id) => (id ? unwrapApi(api.players.getCustomization(id)) : null)
	);

	const backgroundPreview = $derived.by(() => {
		if (clearBackground) {
			return null;
		}

		return previewUrl ?? customization.current?.backgroundUrl ?? null;
	});
	const showClearBackground = $derived(
		Boolean(backgroundFile || customization.current?.backgroundUrl)
	);
	const loadErrorMessage = $derived(
		customization.error ? t('Failed to load profile customization.') : null
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

	function addOtherLink() {
		if (!canAddOtherLink) {
			return;
		}

		otherLinks = [...otherLinks, { id: crypto.randomUUID(), label: '', url: '' }];
	}

	function removeOtherLink(index: number) {
		otherLinks = otherLinks.filter((_, i) => i !== index);
	}

	function updateOtherLink(index: number, field: 'label' | 'url', value: string) {
		otherLinks = otherLinks.map((link, i) => (i === index ? { ...link, [field]: value } : link));
	}

	function clearBackgroundImage() {
		clearBackground = true;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}

		previewUrl = null;
		backgroundFile = null;
	}

	async function selectBackground() {
		const path = await open({
			filters: [
				{
					name: t('Image Files'),
					extensions: ['png', 'jpg', 'jpeg', 'webp']
				}
			],
			multiple: false,
			title: t('Select a background image')
		});
		if (!path || Array.isArray(path)) {
			return;
		}

		const file = new File([await readFile(path)], await basename(path));
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}

		backgroundFile = file;
		previewUrl = URL.createObjectURL(file);
		clearBackground = false;
		saveSuccess = false;
	}

	async function saveProfile() {
		if (!steamId) {
			return;
		}

		saveError = null;
		saveSuccess = false;
		const links = buildProfileLinks({ twitchUrl, youtubeUrl, others: otherLinks });
		if (links.isErr()) {
			saveError = t(links.error.message);
			return;
		}

		saving = true;
		const result = await api.players.updateCustomization({
			steamId,
			bio,
			links: links.value,
			background: backgroundFile,
			clearBackground
		});
		saving = false;
		if (result.isErr()) {
			saveError = t(result.error.message);
			return;
		}

		customization.mutate(result.value);
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}

		backgroundFile = null;
		clearBackground = false;
		saveSuccess = true;
	}
</script>

<div class={flushHeader}>
	<h1 class="font-heading text-xl font-bold text-white">{t('Update profile')}</h1>
	{#if steamId}
		<p class={flushHeaderDescription}>
			<Button href={`/players/${steamId}`} variant="link" class="h-auto px-0">
				{t('View profile')}
			</Button>
		</p>
	{/if}
</div>

{#if !steamId}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Link your Steam account to customize your player profile.')}
	</p>
{:else if customization.loading && !customization.current}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Loading...')}
	</p>
{:else if loadErrorMessage}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{loadErrorMessage}
	</p>
{:else}
	<Form.Root>
		<Form.Group label={t('Bio')} description={t('Up to 500 characters.')}>
			<Textarea id="profile-bio" rows={4} maxlength={PROFILE_BIO_MAX} bind:value={bio} />
		</Form.Group>

		<Form.Group label={t('Twitch URL')}>
			<Input id="profile-twitch" type="url" bind:value={twitchUrl} />
		</Form.Group>

		<Form.Group label={t('YouTube URL')}>
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
					<Button type="button" variant="secondary" onclick={() => removeOtherLink(index)}>
						{t('Remove')}
					</Button>
				</div>
			{/each}
			{#if canAddOtherLink}
				<div>
					<Button type="button" variant="secondary" onclick={addOtherLink}>{t('Add link')}</Button>
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
					<Button variant="secondary" type="button" class="w-fit" onclick={selectBackground}>
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
					<Button type="button" loading={saving} disabled={saving} onclick={saveProfile}>
						{t('Save profile')}
					</Button>
					{#if saveError}
						<p class="text-destructive text-sm">{saveError}</p>
					{/if}
					{#if saveSuccess}
						<p class="text-success text-sm">{t('Profile updated.')}</p>
					{/if}
				</div>
			{/snippet}
		</Form.Group>
	</Form.Root>
{/if}
