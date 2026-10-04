<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { LoginForm } from '@company-of-heroes/ui/auth';
	import { Button } from '@company-of-heroes/ui/button';
	import { cn } from '$lib/utils/cn';
	import { interactive } from '$lib/utils/variants';
	import { href, useI18n } from '$lib/i18n';
	import DesktopIcon from 'phosphor-svelte/lib/DesktopIcon';
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
		form?.message ??
			(page.url.searchParams.get('error') ? t(page.url.searchParams.get('error')!) : null)
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
		if (redirectTarget && redirectTarget !== '/') {
			params.set('redirect', redirectTarget);
		}

		window.location.href = `/auth/steam/start?${params.toString()}`;
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

<LoginForm
	method="POST"
	bind:email
	bind:password
	{error}
	{submitting}
	steamPending={steamLoginPending}
	busy={appLoginPending}
	onSteam={loginWithSteam}
	{@attach (node: HTMLFormElement) => enhance(node, onSubmit).destroy}
>
	<input type="hidden" name="redirect" value={redirectTarget} />
	{#snippet footer()}
		<p class="text-secondary-400 text-sm">
			{t('No account?')}
			<a href={href('/register')} class={linkClass}>{t('Create one')}</a>
		</p>
	{/snippet}
	{#snippet alternatives()}
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
	{/snippet}
</LoginForm>

<p class="text-secondary-500 border-secondary-800 border-b px-4 py-3 text-sm">
	{t('By signing in you agree to our')}
	<a href={href('/privacy')} class={linkClass}>{t('privacy policy')}</a>.
</p>
