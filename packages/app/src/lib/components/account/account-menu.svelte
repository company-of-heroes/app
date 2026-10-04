<script lang="ts">
	import * as Dropdown from '$lib/components/ui/dropdown';
	import { Avatar } from '$lib/components/ui/avatar';
	import { interactive } from '$lib/components/ui/variants';
	import { dropdownItemIcon } from '@company-of-heroes/ui/variants';
	import * as User from '$lib/components/user';
	import AccountSignIn from './account-sign-in.svelte';
	import { app } from '$core/app/context';
	import { goto } from '$app/navigation';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';

	type Props = { active?: boolean };

	let { active = false }: Props = $props();
	const { t } = useI18n();

	/**
	 * Restarts the app as the new user (or into the sign-in screen after signing out).
	 * Loads the splash like a normal app start: a fresh document on another route
	 * would first have to redirect there before the router is up.
	 */
	function restartApp() {
		window.location.assign('/splashscreen');
	}

	function signInWithAnotherAccount() {
		app.modal.create({
			title: t('Sign in with another account'),
			component: AccountSignIn,
			props: { onSignedIn: restartApp }
		});
		app.modal.open();
	}

	/** A generated account without a real email cannot be signed in to again. */
	async function signOut() {
		if (
			app.account.isPlaceholderEmail &&
			!(await confirm(
				t(
					'This account still uses a generated email address. Without a real email you cannot sign in to it again, and its match history stays with it.\n\nContinue anyway?'
				),
				{ okLabel: t('Continue'), cancelLabel: t('Cancel'), kind: 'warning' }
			))
		) {
			return;
		}

		await app.account.signOut();
		restartApp();
	}
</script>

<Dropdown.Root side="top" align="start" class="w-56">
	{#snippet trigger({ props })}
		<button
			type="button"
			{...props}
			class={cn(
				interactive,
				'group hover:text-secondary-200 flex min-w-0 grow items-center gap-2 text-left text-sm transition-colors'
			)}
			data-active={active}
		>
			<Avatar />
			{#if app.account.user}
				<User.Root user={app.account.user}>
					<User.Name class="text-sm" />
				</User.Root>
			{:else}
				<span class="truncate">{t('My account')}</span>
			{/if}
		</button>
	{/snippet}
	<Dropdown.Item class={dropdownItemIcon} onSelect={() => goto('/account')}>
		{t('My account')}
	</Dropdown.Item>
	<Dropdown.Item class={dropdownItemIcon} onSelect={signInWithAnotherAccount}>
		{t('Sign in with another account')}
	</Dropdown.Item>
	<Dropdown.Item class={dropdownItemIcon} onSelect={() => void signOut()}>
		{t('Sign out')}
	</Dropdown.Item>
</Dropdown.Root>
