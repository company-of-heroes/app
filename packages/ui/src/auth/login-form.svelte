<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import { useI18n } from '@company-of-heroes/i18n';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import SteamLogoIcon from 'phosphor-svelte/lib/SteamLogo';

	type Props = {
		email?: string;
		password?: string;
		error?: string | null;
		/** The email/password submit is running. */
		submitting?: boolean;
		/** The Steam login is running. */
		steamPending?: boolean;
		/** Disables every sign-in button (another login is running). */
		busy?: boolean;
		/** Browser autofill of saved logins; the desktop app turns it off. */
		autofill?: boolean;
		onSteam: () => void;
		/** Inside the form, e.g. hidden inputs. */
		children?: Snippet;
		/** Next to the submit button, e.g. a register link. */
		footer?: Snippet;
		/** More sign-in buttons after Steam. */
		alternatives?: Snippet;
	} & Omit<HTMLFormAttributes, 'children'>;

	let {
		email = $bindable(''),
		password = $bindable(''),
		error = null,
		submitting = false,
		steamPending = false,
		busy = false,
		autofill = true,
		onSteam,
		children,
		footer: footerContent,
		alternatives,
		...restProps
	}: Props = $props();

	const { t } = useI18n();
	const disabled = $derived(submitting || steamPending || busy);
</script>

<form autocomplete={autofill ? undefined : 'off'} {...restProps}>
	{@render children?.()}
	<Form.Group label={t('Email')} inputId="login-email">
		<Input
			id="login-email"
			name="email"
			type="email"
			autocomplete={autofill ? 'email' : 'off'}
			required
			bind:value={email}
		/>
	</Form.Group>
	<Form.Group label={t('Password')} inputId="login-password">
		<Input
			id="login-password"
			name="password"
			type="password"
			autocomplete={autofill ? 'current-password' : 'off'}
			required
			bind:value={password}
		/>
	</Form.Group>
	{#if error}
		<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">{error}</p>
	{/if}
	<Form.Group>
		{#snippet footer()}
			<Button type="submit" loading={submitting} {disabled}>
				{t('Log in')}
			</Button>
			{@render footerContent?.()}
		{/snippet}
	</Form.Group>
</form>

<div class="border-secondary-800 border-b px-4 py-3">
	<div class="flex flex-wrap items-center gap-3">
		<span class="text-secondary-500 text-xs tracking-wide uppercase">{t('OR')}</span>
		<Button type="button" variant="secondary" loading={steamPending} {disabled} onclick={onSteam}>
			<SteamLogoIcon size={18} weight="fill" class="text-primary shrink-0" />
			{t('Log in with Steam')}
		</Button>
		{@render alternatives?.()}
	</div>
</div>
