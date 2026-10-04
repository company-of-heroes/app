<script lang="ts">
	import { LoginForm, RegisterForm } from '@company-of-heroes/ui/auth';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { Button } from '$lib/components/ui/button';
	import { account } from '$core/account';
	import { useI18n } from '$lib/i18n';

	type Props = {
		/** Runs after the new account is stored. */
		onSignedIn: () => void | Promise<void>;
		/** Offers "Create anonymous account" (the app generates the login). */
		onAnonymous?: () => void;
	};

	let { onSignedIn, onAnonymous }: Props = $props();

	const { t } = useI18n();
	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	function showMode(next: 'login' | 'register') {
		mode = next;
		error = null;
	}

	async function run(action: () => Promise<string | null>) {
		if (submitting) {
			return;
		}

		submitting = true;
		error = null;
		const message = await action();
		submitting = false;
		if (message) {
			error = message;
			return;
		}

		await onSignedIn();
	}

	function login(event: SubmitEvent) {
		event.preventDefault();
		void run(() => account.loginWithPassword(email, password));
	}

	function register(event: SubmitEvent) {
		event.preventDefault();
		if (password !== passwordConfirm) {
			error = t('Passwords do not match.');
			return;
		}

		if (password.length < 8) {
			error = t('Password must be at least 8 characters.');
			return;
		}

		void run(() => account.register(email, password));
	}

	/** An anonymous account only lives on this device: say so before creating one. */
	async function continueAnonymously() {
		const ok = await confirm(
			t(
				'An anonymous account gets a generated email address and password that only this app knows.\n\n• You cannot log in on coh1stats.com or on another computer.\n• You cannot reset the password: if the app data and its backups are lost, the account and its match history are lost too.\n• You can still set your own email and password later on the Account page.\n\nContinue anonymously?'
			),
			{ okLabel: t('Continue anonymously'), cancelLabel: t('Cancel'), kind: 'warning' }
		);
		if (ok) {
			onAnonymous?.();
		}
	}

	async function signInWithSteam() {
		error = null;
		const result = await account.loginWithSteam();
		if (result.error) {
			error = t(result.error);
			return;
		}

		if (!result.cancelled) {
			await onSignedIn();
		}
	}
</script>

{#if mode === 'login'}
	<LoginForm
		autofill={false}
		bind:email
		bind:password
		{error}
		{submitting}
		steamPending={account.isSteamLoginPending}
		onSteam={signInWithSteam}
		onsubmit={login}
	>
		{#snippet alternatives()}
			{#if account.isSteamLoginPending}
				<Button type="button" variant="ghost" onclick={() => account.cancelSteamLogin()}>
					{t('Cancel')}
				</Button>
			{/if}
		{/snippet}
	</LoginForm>
	{#if account.isSteamLoginPending}
		<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
			{t('Finish signing in with Steam in your browser.')}
		</p>
	{/if}
	<p class="text-secondary-400 flex flex-wrap items-center gap-x-2 px-4 py-3 text-sm">
		{t('No account?')}
		<Button
			type="button"
			variant="link"
			class="h-auto px-0"
			disabled={submitting || account.isSteamLoginPending}
			onclick={() => showMode('register')}
		>
			{t('Register an account')}
		</Button>
		{#if onAnonymous}
			<span aria-hidden="true">·</span>
			<Button
				type="button"
				variant="link"
				class="h-auto px-0"
				disabled={submitting || account.isSteamLoginPending}
				onclick={continueAnonymously}
			>
				{t('Continue anonymously')}
			</Button>
		{/if}
	</p>
{:else}
	<RegisterForm
		bind:email
		bind:password
		bind:passwordConfirm
		{error}
		{submitting}
		onsubmit={register}
	>
		{#snippet footer()}
			<Button type="button" variant="ghost" onclick={() => showMode('login')}>
				{t('Back to log in')}
			</Button>
		{/snippet}
	</RegisterForm>
{/if}
