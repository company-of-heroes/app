<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { cn } from '$lib/utils/cn';
	import { interactive } from '$lib/utils/variants';
	import { href, useI18n } from '$lib/i18n';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const { t } = useI18n();
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let submitting = $state(false);
	const error = $derived(form?.message ?? null);

	const linkClass = cn(interactive, 'text-primary hover:underline');

	const onSubmit: SubmitFunction = () => {
		submitting = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				window.location.assign(result.location);
				return;
			}

			await update();
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>{t('Create account')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Create a Company of Heroes Companion account to use on coh1stats.com and the desktop app.'
		)}
	/>
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Create account')}</h1>
		<p class="text-secondary-400 mt-1 text-sm">
			{t('Your account works on the website and the desktop app. Already have one?')}
			<a href={href('/login')} class={linkClass}>{t('Log in')}</a>.
		</p>
	</div>
</div>

<form method="POST" use:enhance={onSubmit}>
	<Form.Group
		label={t('Email')}
		inputId="register-email"
		description={t('Use a real email if you want to recover your account later.')}
	>
		<Input
			id="register-email"
			name="email"
			type="email"
			autocomplete="email"
			required
			bind:value={email}
		/>
	</Form.Group>
	<Form.Group label={t('Password')} inputId="register-password">
		<Input
			id="register-password"
			name="password"
			type="password"
			autocomplete="new-password"
			required
			minlength={8}
			bind:value={password}
		/>
	</Form.Group>
	<Form.Group label={t('Confirm password')} inputId="register-password-confirm">
		<Input
			id="register-password-confirm"
			name="passwordConfirm"
			type="password"
			autocomplete="new-password"
			required
			minlength={8}
			bind:value={passwordConfirm}
		/>
	</Form.Group>
	{#if error}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{error}</p>
	{/if}
	<Form.Group>
		{#snippet footer()}
			<Button type="submit" loading={submitting} disabled={submitting}>{t('Create account')}</Button>
			<p class="text-secondary-400 text-sm">
				{t('Already have an account?')}
				<a href={href('/login')} class={linkClass}>{t('Log in')}</a>
			</p>
		{/snippet}
	</Form.Group>
</form>

<p class="text-secondary-500 border-secondary-800 border-b px-4 py-3 text-sm">
	{t('By creating an account you agree to our')}
	<a href={href('/privacy')} class={linkClass}>{t('privacy policy')}</a>.
</p>
