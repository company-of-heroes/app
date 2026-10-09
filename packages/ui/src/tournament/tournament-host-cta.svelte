<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FlagBannerIcon from 'phosphor-svelte/lib/FlagBannerIcon';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { untrack } from 'svelte';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import * as Form from '../ui/form';
	import { Input, Textarea } from '../ui/input';
	import type { MyTournamentHostRequest } from './types';

	const { t } = useI18n();
	const host = useHost();

	/** The server's minimum, so the button only enables when the request can go through. */
	const MIN_MESSAGE = 20;

	let request = $state.raw<MyTournamentHostRequest | null>(null);
	let loaded = $state(false);
	let open = $state(false);
	let message = $state('');
	let discord = $state('');
	let sending = $state(false);

	const user = $derived(host.auth.user);
	const pending = $derived(request?.status === 'pending');

	// Untracked: on the website `myHostRequest()` is a remote command.
	$effect(() => {
		if (user && !user.canHost) {
			untrack(() => {
				host.api.tournaments
					.myHostRequest()
					.then((latest) => (request = latest))
					.catch(() => {})
					.finally(() => (loaded = true));
			});
		}
	});

	function start() {
		message = '';
		discord = '';
		open = true;
	}

	async function send() {
		if (sending) {
			return;
		}

		sending = true;
		try {
			request = await host.api.tournaments.requestHost({ message, discord });
			host.notify.success(t('Thanks! Staff got your request and will get back to you.'));
			open = false;
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			sending = false;
		}
	}
</script>

{#if !user?.canHost}
	<section
		class="border-secondary-800 flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center"
	>
		<span
			class="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
		>
			<FlagBannerIcon size={22} weight="duotone" />
		</span>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<p class="font-semibold text-white">{t('Host your own tournament')}</p>
			<p class="text-secondary-400 text-sm">
				{#if pending}
					{t('Your request is waiting for staff. You get a notification when they decide.')}
				{:else if request?.status === 'declined'}
					{t('Staff declined your last request.')}
					{#if request.staffNote}
						<span class="text-secondary-300">“{request.staffNote}”</span>
					{/if}
				{:else}
					{t(
						'Want to run a tournament for the community? Ask staff for the host role: you create the tournament and run it on this site.'
					)}
				{/if}
			</p>
		</div>
		{#if !user}
			<Button href={host.routes.login()} variant="secondary" class="shrink-0">
				{t('Sign in to request')}
			</Button>
		{:else if pending}
			<span class="text-secondary-300 flex shrink-0 items-center gap-1.5 text-sm">
				<ClockIcon size={16} />
				{t('Waiting for staff')}
			</span>
		{:else if loaded}
			<Button variant="secondary" class="shrink-0" onclick={start}>
				{request?.status === 'declined' ? t('Ask again') : t('Request to host')}
			</Button>
		{/if}
	</section>
{/if}

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next && !sending) {
			open = false;
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 w-[560px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<div class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<Dialog.Title class={flushHeaderTitle}>{t('Request to host')}</Dialog.Title>
						<Dialog.Description class={flushHeaderDescription}>
							{t(
								'Staff read your request. Once approved you can create tournaments and run the ones you created.'
							)}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={t('Close')}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</div>
			<form
				class="flex flex-col"
				onsubmit={(event) => {
					event.preventDefault();
					void send();
				}}
			>
				<Form.Group label={t('What do you want to host?')} inputId="host-request-message" wide>
					<Textarea
						id="host-request-message"
						bind:value={message}
						maxlength={2000}
						rows={5}
						placeholder={t(
							'Format, number of players, how often, and whether you ran tournaments before.'
						)}
						disabled={sending}
					/>
				</Form.Group>
				<Form.Group label={t('Discord name (optional)')} inputId="host-request-discord" wide>
					<Input
						id="host-request-discord"
						bind:value={discord}
						maxlength={100}
						placeholder={t('So staff can get in touch')}
						disabled={sending}
					/>
				</Form.Group>
				<div class="flex flex-wrap justify-end gap-2 px-4 py-4">
					<Button type="button" variant="ghost" disabled={sending} onclick={() => (open = false)}>
						{t('Cancel')}
					</Button>
					<Button
						type="submit"
						disabled={sending || message.trim().length < MIN_MESSAGE}
						loading={sending}
					>
						{t('Send request')}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
