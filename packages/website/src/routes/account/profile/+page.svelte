<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input, Textarea } from '@company-of-heroes/ui/input';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import {
		PROFILE_BIO_MAX,
		PROFILE_OTHER_LINKS_MAX,
		splitProfileLinks
	} from '@company-of-heroes/api';
	import { href, useI18n } from '$lib/i18n';
	import { toast } from '$lib/components/ui/toasts';
	import {
		loadProfileCustomization,
		updateProfileCustomization
	} from '$lib/remote/profile-customization.remote';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const profile = await loadProfileCustomization();
	const { steamId, customization } = profile;
	const initialLinks = splitProfileLinks(customization.links);

	let bio = $state(customization.bio ?? '');
	let twitchUrl = $state(initialLinks.twitchUrl);
	let youtubeUrl = $state(initialLinks.youtubeUrl);
	let otherLinks = $state(
		initialLinks.others.map((link) => ({
			id: crypto.randomUUID(),
			label: link.label ?? '',
			url: link.url ?? ''
		}))
	);
	let clearBackground = $state(false);

	const canAddOtherLink = $derived(otherLinks.length < PROFILE_OTHER_LINKS_MAX);
	const formIssue = $derived(updateProfileCustomization.fields.allIssues()?.[0]?.message);
	const saving = $derived(Boolean(updateProfileCustomization.pending));
	const otherLinksPayload = $derived(
		JSON.stringify(otherLinks.map(({ label, url }) => ({ label, url })))
	);

	onMount(() => {
		if (data.saved !== '1') {
			return;
		}

		toast.success(t('Profile updated.'));
		const next = new URL(page.url);
		next.searchParams.delete('saved');
		replaceState(`${next.pathname}${next.search}`, {});
	});

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
</script>

<svelte:head>
	<title>{t('Update profile')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Customize your public player profile bio, links, and background.')}
	/>
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Update profile')}</h1>
		{#if steamId}
			<p class="text-secondary-400 mt-1 text-sm">
				<a
					href={href(`/players/${steamId}`)}
					class={cn(interactive, 'text-primary hover:underline')}>{t('View profile')}</a
				>
			</p>
		{/if}
	</div>
</div>

{#if !steamId}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Link your Steam account to customize your player profile.')}
	</p>
{:else}
	<form {...updateProfileCustomization} enctype="multipart/form-data">
		<input {...updateProfileCustomization.fields.steamId.as('hidden', steamId)} />
		<input {...updateProfileCustomization.fields.otherLinks.as('hidden', otherLinksPayload)} />
		<input
			{...updateProfileCustomization.fields.clearBackground.as(
				'hidden',
				clearBackground ? '1' : ''
			)}
		/>

		<Form.Group label={t('Bio')} inputId="profile-bio" description={t('Up to 500 characters.')}>
			<Textarea
				id="profile-bio"
				rows={4}
				maxlength={PROFILE_BIO_MAX}
				{...updateProfileCustomization.fields.bio.as('text', bio)}
			/>
		</Form.Group>

		<Form.Group label={t('Twitch URL')} inputId="profile-twitch">
			<Input
				id="profile-twitch"
				type="url"
				{...updateProfileCustomization.fields.twitchUrl.as('text', twitchUrl)}
			/>
		</Form.Group>

		<Form.Group label={t('YouTube URL')} inputId="profile-youtube">
			<Input
				id="profile-youtube"
				type="url"
				{...updateProfileCustomization.fields.youtubeUrl.as('text', youtubeUrl)}
			/>
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
						<label class="text-secondary-400 mb-1 block text-xs" for={`other-label-${link.id}`}
							>{t('Label')}</label
						>
						<Input
							id={`other-label-${link.id}`}
							value={link.label}
							maxlength={40}
							oninput={(event) =>
								updateOtherLink(index, 'label', (event.currentTarget as HTMLInputElement).value)}
						/>
					</div>
					<div class="min-w-0 flex-[2]">
						<label class="text-secondary-400 mb-1 block text-xs" for={`other-url-${link.id}`}
							>{t('URL')}</label
						>
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
			{#if customization.backgroundUrl && !clearBackground}
				<img
					src={customization.backgroundUrl}
					alt={t('Background')}
					class="mb-3 max-h-40 w-full max-w-md rounded-md object-cover"
				/>
			{:else if !customization.backgroundUrl}
				<div
					class="bg-secondary-950 text-secondary-400 mb-3 flex h-24 max-w-md items-center justify-center rounded-md text-xs"
				>
					{t('No background')}
				</div>
			{/if}
			{#snippet footer()}
				<div class="flex flex-wrap items-center gap-2">
					<input
						accept="image/jpeg,image/jpg,image/png,image/webp"
						class="text-secondary-400 file:bg-secondary-800 text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-sm file:text-white"
						{...updateProfileCustomization.fields.background.as('file')}
						onchange={() => {
							clearBackground = false;
						}}
					/>
					{#if customization.backgroundUrl && !clearBackground}
						<Button type="button" variant="secondary" onclick={() => (clearBackground = true)}>
							{t('Clear background')}
						</Button>
					{/if}
				</div>
			{/snippet}
		</Form.Group>

		{#if formIssue}
			<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{formIssue}</p>
		{/if}

		<Form.Group>
			{#snippet footer()}
				<Button type="submit" loading={saving} disabled={saving}>{t('Save profile')}</Button>
			{/snippet}
		</Form.Group>
	</form>
{/if}
