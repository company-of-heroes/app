<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { canRequestEmailChange, isPlaceholderEmail } from '@company-of-heroes/api';
	import { href, useI18n } from '$lib/i18n';
	import {
		requestEmailChange,
		requestVerification,
		updatePassword,
		updateProfile
	} from '$lib/remote/account.remote';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const user = $derived(data.user);
	const canChangeEmail = $derived(canRequestEmailChange(user));
	const isPlaceholder = $derived(isPlaceholderEmail(user.email));
	const needsVerification = $derived(!user.verified && !isPlaceholder);

	const banner = $derived.by(() => {
		if (data.saved === 'profile') {
			return t('Profile updated.');
		}

		if (data.saved === 'password') {
			return t('Password updated.');
		}

		if (data.saved === 'email') {
			return t('Email updated.');
		}

		if (data.saved === 'verified') {
			return t('Your email has been verified.');
		}

		if (data.sent === 'verification') {
			return t('Verification email sent. Check your inbox.');
		}

		if (data.sent === 'email-change') {
			return t('Confirmation email sent to your new address. Check your inbox.');
		}

		return null;
	});

	const profileIssue = $derived(updateProfile.fields.allIssues()?.[0]?.message);
	const verificationIssue = $derived(requestVerification.fields.allIssues()?.[0]?.message);
	const emailChangeIssue = $derived(requestEmailChange.fields.allIssues()?.[0]?.message);
	const passwordIssue = $derived(updatePassword.fields.allIssues()?.[0]?.message);
</script>

<svelte:head>
	<title>{t('Account')} | {t('Company of Heroes 1 Stats')}</title>
	<meta name="description" content={t('Update your display name, avatar, email, and password.')} />
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Account settings')}</h1>
		<p class="text-secondary-400 mt-1 text-sm">
			{t('These credentials work on the website and in the desktop app.')}
			<a href={href('/privacy')} class="text-primary hover:underline">{t('Privacy policy')}</a>
		</p>
	</div>
</div>

{#if banner}
	<p class="text-success border-secondary-800 border-b px-4 py-3 text-sm">{banner}</p>
{/if}

<form {...updateProfile} enctype="multipart/form-data">
	<Form.Group label={t('Avatar')}>
		{#if user.avatarUrl}
			<img
				src={user.avatarUrl}
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
			<input
				type="file"
				accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
				class="text-secondary-400 text-sm file:bg-secondary-800 file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-sm file:text-white"
				{...updateProfile.fields.avatar.as('file')}
			/>
		{/snippet}
	</Form.Group>
	<Form.Group label={t('Display name')} inputId="account-name">
		<Input id="account-name" {...updateProfile.fields.name.as('text', user.name ?? '')} />
	</Form.Group>
	{#if profileIssue}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{profileIssue}</p>
	{/if}
	<Form.Group>
		{#snippet footer()}
			<Button type="submit">{t('Save profile')}</Button>
		{/snippet}
	</Form.Group>
</form>

<div class="border-secondary-800 border-b px-4 py-3">
	<p class="text-sm font-medium text-white">{t('Email')}</p>
	<p class="text-secondary-400 mt-1 text-sm">{user.email}</p>
	{#if user.verified}
		<p class="text-success mt-1 text-xs">{t('Verified')}</p>
	{:else if isPlaceholder}
		<p class="text-secondary-400 mt-1 text-xs">
			{t('This is a placeholder address. Set a real email below to use it for sign-in recovery.')}
		</p>
	{:else}
		<p class="text-warning mt-1 text-xs">{t('Not verified')}</p>
	{/if}
</div>

{#if needsVerification}
	<form {...requestVerification}>
		<input {...requestVerification.fields.email.as('hidden', user.email)} />
		<Form.Group
			label={t('Verify email')}
			description={t('Verify your current email before you can change it.')}
		>
			{#snippet footer()}
				{#if verificationIssue}
					<p class="text-destructive text-sm">{verificationIssue}</p>
				{/if}
				<Button type="submit" variant="secondary">{t('Send verification email')}</Button>
			{/snippet}
		</Form.Group>
	</form>
{/if}

{#if canChangeEmail}
	<form {...requestEmailChange}>
		<Form.Group
			label={t('New email')}
			inputId="account-new-email"
			description={t(
				'We will send a confirmation link to the new address. Your email will not change until you confirm it.'
			)}
		>
			<Input
				id="account-new-email"
				type="email"
				autocomplete="email"
				{...requestEmailChange.fields.newEmail.as('email')}
			/>
			{#snippet footer()}
				{#if emailChangeIssue}
					<p class="text-destructive text-sm">{emailChangeIssue}</p>
				{/if}
				<Button type="submit" variant="secondary">{t('Request email change')}</Button>
			{/snippet}
		</Form.Group>
	</form>
{:else}
	<div class="border-secondary-800 text-secondary-400 border-b px-4 py-3 text-sm">
		{t('Verify your email before changing it.')}
	</div>
{/if}

<form {...updatePassword}>
	<Form.Group label={t('Current password')} inputId="account-old-password">
		<Input
			id="account-old-password"
			type="password"
			autocomplete="current-password"
			{...updatePassword.fields.oldPassword.as('password')}
		/>
	</Form.Group>
	<Form.Group label={t('New password')} inputId="account-password">
		<Input
			id="account-password"
			type="password"
			autocomplete="new-password"
			{...updatePassword.fields.password.as('password')}
		/>
	</Form.Group>
	<Form.Group label={t('Confirm new password')} inputId="account-password-confirm">
		<Input
			id="account-password-confirm"
			type="password"
			autocomplete="new-password"
			{...updatePassword.fields.passwordConfirm.as('password')}
		/>
	</Form.Group>
	{#if passwordIssue}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{passwordIssue}</p>
	{/if}
	<Form.Group>
		{#snippet footer()}
			<Button type="submit">{t('Update password')}</Button>
		{/snippet}
	</Form.Group>
</form>
