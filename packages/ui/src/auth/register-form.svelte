<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import { useI18n } from '@company-of-heroes/i18n';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';

	type Props = {
		email?: string;
		password?: string;
		passwordConfirm?: string;
		error?: string | null;
		submitting?: boolean;
		/** Inside the form, e.g. hidden inputs. */
		children?: Snippet;
		/** Next to the submit button, e.g. a log in link. */
		footer?: Snippet;
	} & Omit<HTMLFormAttributes, 'children'>;

	let {
		email = $bindable(''),
		password = $bindable(''),
		passwordConfirm = $bindable(''),
		error = null,
		submitting = false,
		children,
		footer: footerContent,
		...restProps
	}: Props = $props();

	const { t } = useI18n();
</script>

<form {...restProps}>
	{@render children?.()}
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
			<Button type="submit" loading={submitting} disabled={submitting}>
				{t('Create account')}
			</Button>
			{@render footerContent?.()}
		{/snippet}
	</Form.Group>
</form>
