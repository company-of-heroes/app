<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { watch } from 'runed';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { Textarea } from '../ui/input';
	import { ToggleGroup } from '../ui/toggle-group';
	import { parseTournamentDate } from './format';
	import type { TournamentHost, TournamentHostRequest } from './types';

	type Props = {
		open: boolean;
		onClose: () => void;
		/** Open requests after a load or a decision, for the button's count. */
		onCount?: (pending: number) => void;
	};

	let { open, onClose, onCount }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let requests = $state.raw<TournamentHostRequest[]>([]);
	let hosts = $state.raw<TournamentHost[]>([]);
	let loading = $state(false);
	let view = $state<string>('pending');
	let notes = $state<Record<string, string>>({});
	let saving = $state<string | null>(null);

	const pending = $derived(requests.filter((request) => request.status === 'pending'));
	const handled = $derived(requests.filter((request) => request.status !== 'pending'));
	const views = $derived([
		{ value: 'pending', label: t('Open ({count})', { count: pending.length }) },
		{ value: 'handled', label: t('Handled ({count})', { count: handled.length }) },
		{ value: 'hosts', label: t('Hosts ({count})', { count: hosts.length }) }
	]);

	const date = (value: string) => formatDate(parseTournamentDate(value), host.locale(), 'dateTime');

	async function load() {
		loading = true;
		try {
			[requests, hosts] = await Promise.all([
				host.api.tournaments.hostRequests(),
				host.api.tournaments.hosts()
			]);
			onCount?.(requests.filter((request) => request.status === 'pending').length);
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			loading = false;
		}
	}

	watch(
		() => open,
		(isOpen) => {
			if (isOpen) {
				view = 'pending';
				notes = {};
				void load();
			}
		}
	);

	async function decide(request: TournamentHostRequest, status: 'approved' | 'declined') {
		if (saving) {
			return;
		}

		saving = request.id;
		try {
			await host.api.tournaments.decideHostRequest(request.id, {
				status,
				staffNote: notes[request.id] ?? ''
			});
			host.notify.success(
				status === 'approved'
					? t('{name} can now host tournaments.', { name: request.user.name })
					: t('Request declined. {name} got your note.', { name: request.user.name })
			);
			await load();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			saving = null;
		}
	}

	async function revoke(target: TournamentHost) {
		if (saving) {
			return;
		}

		const sure = await host.notify.confirm(
			t(
				'Remove the host role from {name}? Their tournaments stay on the site and staff run them.',
				{ name: target.name }
			),
			{ confirm: t('Remove host role'), cancel: t('Cancel') }
		);
		if (!sure) {
			return;
		}

		saving = target.id;
		try {
			await host.api.tournaments.revokeHost(target.id);
			host.notify.success(t('{name} is no longer a host.', { name: target.name }));
			await load();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			saving = null;
		}
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next) {
			onClose();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto my-12 flex max-h-[calc(100dvh-6rem)] w-[720px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<div class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<Dialog.Title class={flushHeaderTitle}>{t('Tournament hosts')}</Dialog.Title>
						<Dialog.Description class={flushHeaderDescription}>
							{t(
								'Approve a request to give the player the host role: they create tournaments and run only their own.'
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
			<div class="border-secondary-800 border-b px-4 py-2.5">
				<ToggleGroup bind:value={view} items={views} size="sm" aria-label={t('Show')} />
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if loading && requests.length === 0 && hosts.length === 0}
					<p class="text-secondary-400 px-4 py-4 text-sm">{t('Loading...')}</p>
				{:else if view === 'hosts'}
					{#if hosts.length === 0}
						<p class="text-secondary-400 px-4 py-4 text-sm">{t('Nobody has the host role yet.')}</p>
					{:else}
						<ul class="[&>li:last-child]:border-b-0">
							{#each hosts as item (item.id)}
								<li class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
									<div class="flex min-w-0 flex-1 flex-col">
										<p class="truncate font-semibold text-white">{item.name}</p>
										<p class="text-secondary-400 text-xs">
											{item.tournaments === 1
												? t('1 tournament')
												: t('{count} tournaments', { count: item.tournaments })}
										</p>
									</div>
									<Button
										size="sm"
										variant="ghost"
										disabled={saving !== null}
										loading={saving === item.id}
										onclick={() => revoke(item)}
									>
										{t('Remove host role')}
									</Button>
								</li>
							{/each}
						</ul>
					{/if}
				{:else}
					{@const shown = view === 'pending' ? pending : handled}
					{#if shown.length === 0}
						<p class="text-secondary-400 px-4 py-4 text-sm">{t('No requests here.')}</p>
					{:else}
						<ul class="[&>li:last-child]:border-b-0">
							{#each shown as request (request.id)}
								{@const busy = saving === request.id}
								<li class="border-secondary-800 flex flex-col gap-3 border-b px-4 py-4">
									<div class="flex flex-wrap items-start justify-between gap-2">
										<div class="flex min-w-0 flex-col gap-0.5">
											<p class="truncate font-semibold text-white">{request.user.name}</p>
											<p class="text-secondary-500 text-xs">
												{t('Sent on {date}', { date: date(request.created) })}
												{#if request.discord}
													· {t('Discord: {name}', { name: request.discord })}
												{/if}
											</p>
										</div>
										{#if request.status !== 'pending'}
											<Badge
												variant={request.status === 'approved' ? 'success' : 'default'}
												class="shrink-0"
											>
												{request.status === 'approved' ? t('Approved') : t('Declined')}
											</Badge>
										{/if}
									</div>
									<p class="text-secondary-300 text-sm break-words whitespace-pre-line">
										{request.message}
									</p>
									{#if request.status === 'pending'}
										<Textarea
											bind:value={
												() => notes[request.id] ?? '', (value) => (notes[request.id] = value)
											}
											maxlength={2000}
											rows={2}
											placeholder={t('Note for the player (optional)')}
											aria-label={t('Note for the player (optional)')}
											disabled={busy}
										/>
										<div class="flex flex-wrap justify-end gap-2">
											<Button
												size="sm"
												variant="ghost"
												disabled={saving !== null}
												onclick={() => decide(request, 'declined')}
											>
												{t('Decline')}
											</Button>
											<Button
												size="sm"
												disabled={saving !== null}
												loading={busy}
												onclick={() => decide(request, 'approved')}
											>
												{t('Approve')}
											</Button>
										</div>
									{:else}
										{#if request.staffNote}
											<p class="text-secondary-300 text-sm">
												<span class="text-secondary-500">{t('Note:')}</span>
												{request.staffNote}
											</p>
										{/if}
										{#if request.handledBy && request.handledAt}
											<p class="text-secondary-500 text-xs">
												{t('Handled by {name} on {date}', {
													name: request.handledBy.name,
													date: date(request.handledAt)
												})}
											</p>
										{/if}
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
