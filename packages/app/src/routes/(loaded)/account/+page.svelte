<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { app } from '$core/app/context';
	import { fetch } from '$core/http/fetch';
	import { Button } from '$lib/components/ui/button';
	import { flushHeader, flushHeaderDescription } from '$lib/components/ui/variants';
	import { open } from '@tauri-apps/plugin-dialog';
	import ImageCropper from '$lib/components/modals/image-cropper.svelte';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { useI18n } from '$lib/i18n';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
	import { accountUrl, privacyUrl, SITE_URL } from '$core/site/urls';

	const { t } = useI18n();

	let displayName = $state(app.features.auth.user.name ?? '');
	let password = $state(app.account.settings.password);
	let newEmail = $state('');
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let emailBusy = $state(false);
	let emailMessage = $state<string | null>(null);
	let emailError = $state<string | null>(null);

	const currentEmail = $derived(app.account.email);
	const verified = $derived(app.account.isEmailVerified);
	const canChangeEmail = $derived(app.account.canChangeEmail);
	const isPlaceholder = $derived(app.account.isPlaceholderEmail);
	const needsVerification = $derived(!verified && !isPlaceholder);

	const selectAvatar = async () => {
		const path = await open({
			filters: [
				{
					name: t('Image Files'),
					extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
				}
			],
			multiple: false,
			title: t('Select an avatar image')
		});
		if (!path) {
			return;
		}

		const file = await readFile(path);
		const url = URL.createObjectURL(new Blob([file], { type: 'image/*' }));
		app.modal.create({
			title: t('Crop Image'),
			component: ImageCropper,
			props: {
				image: url,
				oncrop: async (blob: Blob) => {
					return app.pocketbase
						.collection('users')
						.update(
							app.features.auth.userId,
							{
								avatar: new File([blob], app.features.auth.userId, { type: blob.type })
							},
							{ fetch }
						)
						.then(() => {
							app.features.auth.refreshUser();
						});
				}
			}
		});
		app.modal.open();
	};

	async function saveAccount() {
		saving = true;
		saveError = null;
		saveSuccess = false;
		const error = await app.account.updateLoginCredentials({
			name: displayName,
			password
		});
		saving = false;
		if (error) {
			saveError = error;
			return;
		}

		displayName = app.features.auth.user.name ?? '';
		password = app.account.settings.password;
		saveSuccess = true;
	}

	async function sendVerification() {
		emailBusy = true;
		emailError = null;
		emailMessage = null;
		const error = await app.account.requestVerificationEmail();
		emailBusy = false;
		if (error) {
			emailError = error;
			return;
		}

		emailMessage = t('Verification email sent. Check your inbox.');
	}

	async function submitEmailChange() {
		emailBusy = true;
		emailError = null;
		emailMessage = null;
		const error = await app.account.requestEmailChange(newEmail);
		emailBusy = false;
		if (error) {
			emailError = error;
			return;
		}

		newEmail = '';
		emailMessage = t(
			'Confirmation email sent to your new address. Open the link on the website to finish.'
		);
	}

	async function refreshAccount() {
		await app.account.refreshUser();
		displayName = app.features.auth.user.name ?? '';
		password = app.account.settings.password;
	}
</script>

<div class={flushHeader}>
	<p class={flushHeaderDescription}>
		{t(
			'When you install the app, we automatically create a default account for you using a randomly generated email address and password. Set a display name, email, and password you recognize — the same credentials log you in on'
		)}
		<Button variant="link" class="h-auto px-0" type="button" onclick={() => openUrl(SITE_URL)}>
			{SITE_URL}
		</Button>
		{t('and in the desktop app.')}
		<Button variant="link" class="h-auto px-0" type="button" onclick={() => openUrl(privacyUrl)}>
			{t('Privacy policy')}
		</Button>
	</p>
</div>

<Form.Root>
	<Form.Group label={t('Update Account Settings')} />
	<Form.Group label={t('Avatar')}>
		{#if app.features.auth.avatarUrl}
			<img
				src={app.features.auth.avatarUrl}
				alt={t('User Avatar')}
				class="size-16 rounded-md bg-gray-800 object-cover"
			/>
		{:else}
			<div
				class="bg-secondary-950 text-secondary-400 flex size-16 items-center justify-center rounded-md text-xs"
			>
				{t('No Avatar')}
			</div>
		{/if}
		{#snippet footer()}
			<Button variant="secondary" type="button" class="w-fit" onclick={selectAvatar}>
				<ImageIcon size={16} />
				{t('Select image')}
			</Button>
		{/snippet}
	</Form.Group>
	<Form.Group label={t('Displayname')}>
		<Input type="text" bind:value={displayName} />
	</Form.Group>
	<Form.Group
		label={t('Email (Emails are private and will not be shared!)')}
		description={t(
			'This email is used to sign in to your account on the website and in the app. Use a valid email address so you can recover your account.'
		)}
	>
		<div class="flex flex-col gap-2">
			<p class="text-sm text-white">{currentEmail}</p>
			{#if verified}
				<p class="text-success text-xs">{t('Verified')}</p>
			{:else if isPlaceholder}
				<p class="text-secondary-400 text-xs">
					{t(
						'This is a placeholder address. Set a real email below to use it for sign-in recovery.'
					)}
				</p>
			{:else}
				<p class="text-warning text-xs">{t('Not verified')}</p>
			{/if}
		</div>
	</Form.Group>
	{#if needsVerification}
		<Form.Group
			label={t('Verify email')}
			description={t('Verify your current email before you can change it.')}
		>
			{#snippet footer()}
				<Button
					type="button"
					variant="secondary"
					loading={emailBusy}
					disabled={emailBusy}
					onclick={sendVerification}
				>
					{t('Send verification email')}
				</Button>
			{/snippet}
		</Form.Group>
	{/if}
	{#if canChangeEmail}
		<Form.Group
			label={t('New email')}
			description={t(
				'We will send a confirmation link to the new address. Confirm it on the website — your email will not change until then.'
			)}
		>
			<Input type="email" bind:value={newEmail} autocomplete="email" />
			{#snippet footer()}
				<div class="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="secondary"
						loading={emailBusy}
						disabled={emailBusy || !newEmail.trim()}
						onclick={submitEmailChange}
					>
						{t('Request email change')}
					</Button>
					<Button type="button" variant="ghost" onclick={() => openUrl(accountUrl)}>
						{t('Open website account')}
					</Button>
					<Button type="button" variant="ghost" onclick={refreshAccount}>
						{t('Refresh')}
					</Button>
				</div>
			{/snippet}
		</Form.Group>
	{:else}
		<Form.Group>
			<p class="text-secondary-400 text-sm">{t('Verify your email before changing it.')}</p>
		</Form.Group>
	{/if}
	{#if emailError}
		<Form.Group>
			<p class="text-destructive text-sm">{emailError}</p>
		</Form.Group>
	{/if}
	{#if emailMessage}
		<Form.Group>
			<p class="text-success text-sm">{emailMessage}</p>
		</Form.Group>
	{/if}
	<Form.Group label={t('Password')}>
		<Input type="password" bind:value={password} />
	</Form.Group>
	<Form.Group>
		{#snippet footer()}
			<Button type="button" loading={saving} disabled={saving} onclick={saveAccount}>
				{t('Save')}
			</Button>
			{#if saveError}
				<p class="text-destructive text-sm">{saveError}</p>
			{/if}
			{#if saveSuccess}
				<p class="text-success text-sm">{t('Account updated.')}</p>
			{/if}
		{/snippet}
	</Form.Group>
</Form.Root>
