<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { href, useI18n } from '$lib/i18n';
	import { confirmEmailChange } from '$lib/remote/account.remote';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	const issue = $derived(confirmEmailChange.fields.allIssues()?.[0]?.message);
</script>

<svelte:head>
	<title>{t('Confirm new email')} | {t('Company of Heroes 1 Stats')}</title>
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Account')}</p>
		<h1 class="font-heading text-xl font-bold text-white">{t('Confirm new email')}</h1>
		<p class="text-secondary-400 mt-1 text-sm">
			{t('Enter your current password to finish changing your email address.')}
		</p>
	</div>
</div>

{#if !data.token}
	<div class="border-secondary-800 border-b px-4 py-6">
		<p class="text-destructive text-sm">{data.message}</p>
		<div class="mt-4">
			<Button href={href('/account')} variant="secondary">{t('Account')}</Button>
		</div>
	</div>
{:else}
	<form {...confirmEmailChange}>
		<input {...confirmEmailChange.fields.token.as('hidden', data.token)} />
		<Form.Group label={t('Password')} inputId="confirm-email-password">
			<Input
				id="confirm-email-password"
				type="password"
				autocomplete="current-password"
				required
				{...confirmEmailChange.fields.password.as('password')}
			/>
		</Form.Group>
		{#if issue}
			<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{issue}</p>
		{/if}
		<Form.Group>
			{#snippet footer()}
				<Button type="submit">{t('Confirm new email')}</Button>
			{/snippet}
		</Form.Group>
	</form>
{/if}
