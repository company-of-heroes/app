<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { cn } from '$lib/utils/cn';
	import { interactive } from '$lib/utils/variants';
	import { href, useI18n } from '$lib/i18n';
	import { API_URL } from '$lib/site/urls';
	import DesktopIcon from 'phosphor-svelte/lib/DesktopIcon';
	import SteamLogoIcon from 'phosphor-svelte/lib/SteamLogo';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const { t } = useI18n();
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let appLoginPending = $state(false);
	let steamLoginPending = $state(false);

	const redirectTarget = $derived(page.url.searchParams.get('redirect') ?? '/');
	const error = $derived(
		form?.message ?? (page.url.searchParams.get('error') ? t(page.url.searchParams.get('error')!) : null)
	);

	const linkClass = cn(interactive, 'text-primary hover:underline');
	const altLoginBusy = $derived(appLoginPending || steamLoginPending);

	const onSubmit: SubmitFunction = () => {
		submitting = true;
		return async ({ result, update }) => {
			// Full document navigation so layout `user` is not served from a
			// previously cached anonymous `__data.json` / CDN entry.
			if (result.type === 'redirect') {
				window.location.assign(result.location);
				return;
			}

			await update();
			submitting = false;
		};
	};

	function loginWithApp() {
		appLoginPending = true;
		const handoffUrl = new URL('/auth/handoff', page.url.origin);
		const appUrl = new URL('http://127.0.0.1:9842/auth/browser-login');
		appUrl.searchParams.set('redirect_uri', handoffUrl.toString());
		appUrl.searchParams.set('redirect', redirectTarget);
		window.location.href = appUrl.toString();
	}

	function loginWithSteam() {
		steamLoginPending = true;
		const params = new URLSearchParams();
		params.set('origin', page.url.origin);
		if (redirectTarget && redirectTarget !== '/') {
			params.set('redirect', redirectTarget);
		}

		window.location.href = `${API_URL}/api/auth/steam/start?${params.toString()}`;
	}
</script>

<svelte:head>
	<title>{t('Log in')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Log in to your Company of Heroes Companion account on coh1stats.com.')}
	/>
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Log in')}</h1>
		<p class="text-secondary-400 mt-1 text-sm">
			{t('Use the same email and password as the desktop app, or')}
			<a href={href('/register')} class={linkClass}>{t('create an account')}</a>.
		</p>
	</div>
</div>

<form method="POST" use:enhance={onSubmit}>
	<input type="hidden" name="redirect" value={redirectTarget} />
	<Form.Group label={t('Email')} inputId="login-email">
		<Input
			id="login-email"
			name="email"
			type="email"
			autocomplete="email"
			required
			bind:value={email}
		/>
	</Form.Group>
	<Form.Group label={t('Password')} inputId="login-password">
		<Input
			id="login-password"
			name="password"
			type="password"
			autocomplete="current-password"
			required
			bind:value={password}
		/>
	</Form.Group>
	{#if error}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{error}</p>
	{/if}
	<Form.Group>
		{#snippet footer()}
			<Button type="submit" loading={submitting} disabled={submitting || altLoginBusy}>
				{t('Log in')}
			</Button>
			<p class="text-secondary-400 text-sm">
				{t('No account?')}
				<a href={href('/register')} class={linkClass}>{t('Create one')}</a>
			</p>
		{/snippet}
	</Form.Group>
</form>

<div class="border-secondary-800 border-b px-4 py-3">
	<div class="flex flex-wrap items-center gap-3">
		<span class="text-secondary-500 text-xs uppercase tracking-wide">{t('OR')}</span>
		<Button
			type="button"
			variant="secondary"
			loading={steamLoginPending}
			disabled={submitting || altLoginBusy}
			onclick={loginWithSteam}
		>
			<SteamLogoIcon size={18} weight="fill" class="text-primary shrink-0" />
			{t('Log in with Steam')}
		</Button>
		<Button
			type="button"
			variant="secondary"
			loading={appLoginPending}
			disabled={submitting || altLoginBusy}
			onclick={loginWithApp}
		>
			<DesktopIcon size={18} weight="duotone" class="text-primary shrink-0" />
			{t('Log in with app')}
		</Button>
	</div>
</div>

<p class="text-secondary-500 border-secondary-800 border-b px-4 py-3 text-sm">
	{t('By signing in you agree to our')}
	<a href={href('/privacy')} class={linkClass}>{t('privacy policy')}</a>.
</p>
