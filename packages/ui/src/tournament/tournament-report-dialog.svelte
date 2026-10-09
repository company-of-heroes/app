<script lang="ts" module>
	import type { TournamentReportReason, TournamentReportStatus } from './types';

	/** English labels; callers pass them through `t()`. */
	export const REPORT_REASON_LABELS: Record<TournamentReportReason, string> = {
		no_show: 'My opponent did not show up',
		disconnect: 'Disconnect or crash',
		wrong_result: 'The result is wrong',
		conduct: 'Unsportsmanlike behaviour',
		other: 'Something else'
	};

	export const REPORT_STATUS_LABELS: Record<TournamentReportStatus, string> = {
		open: 'Open',
		resolved: 'Resolved',
		dismissed: 'Dismissed'
	};

	export const REPORT_STATUS_VARIANTS = {
		open: 'warning',
		resolved: 'success',
		dismissed: 'default'
	} as const satisfies Record<TournamentReportStatus, string>;
</script>

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
	import { TOURNAMENT_REPORT_REASONS } from '@company-of-heroes/api/tournaments';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import * as Form from '../ui/form';
	import { RadioGroup, Textarea } from '../ui/input';
	import type { MyTournamentMatch } from './types';

	type Props = {
		/** The match to report, or null when closed. */
		item: MyTournamentMatch | null;
		onClose: () => void;
		/** The report was sent: the host reloads the match to list it. */
		onSent?: () => void;
	};

	let { item, onClose, onSent }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// A string for the radio group; always one of TOURNAMENT_REPORT_REASONS.
	let reason = $state<string>('no_show');
	let message = $state('');
	let sending = $state(false);

	watch(
		() => item,
		(current) => {
			if (current) {
				reason = 'no_show';
				message = '';
			}
		}
	);

	async function send() {
		if (!item || sending) {
			return;
		}

		sending = true;
		try {
			await host.api.tournaments.report(item.tournament.id, item.match.id, {
				reason: reason as TournamentReportReason,
				message
			});
			host.notify.success(t('Thanks. Staff got your report and will look into it.'));
			onClose();
			onSent?.();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			sending = false;
		}
	}
</script>

<Dialog.Root
	open={item !== null}
	onOpenChange={(next) => {
		if (!next && !sending) {
			onClose();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 w-[520px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<div class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<Dialog.Title class={flushHeaderTitle}>{t('Report a problem')}</Dialog.Title>
						<Dialog.Description class={flushHeaderDescription}>
							{t('Staff get a message and can set a result, give a new deadline or contact you.')}
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
				<Form.Group label={t('What happened?')} wide>
					<RadioGroup
						bind:value={reason}
						items={TOURNAMENT_REPORT_REASONS.map((value) => ({
							value,
							label: t(REPORT_REASON_LABELS[value])
						}))}
						disabled={sending}
					/>
				</Form.Group>
				<Form.Group label={t('Details')} inputId="tournament-report-message" wide>
					<Textarea
						id="tournament-report-message"
						bind:value={message}
						maxlength={2000}
						rows={4}
						placeholder={t('When did it happen, what did you see? Links to screenshots help.')}
						disabled={sending}
					/>
				</Form.Group>
				<div class="flex flex-wrap justify-end gap-2 px-4 py-4">
					<Button type="button" variant="ghost" disabled={sending} onclick={onClose}>
						{t('Cancel')}
					</Button>
					<Button type="submit" disabled={sending} loading={sending}>
						{t('Send to staff')}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
