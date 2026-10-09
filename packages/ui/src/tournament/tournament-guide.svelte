<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle
	} from '@company-of-heroes/ui/variants';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { parseTournamentDate } from './format';
	import type {
		MyTournamentMatch,
		Tournament,
		TournamentDetail,
		TournamentParticipant
	} from './types';
	import { useTournament } from './context';

	type Props = {
		/** The signed-in participant. */
		me: TournamentParticipant;
		/** Their open match, once the bracket has one for them. */
		match: MyTournamentMatch | null;
		/** They signed in to the desktop app before, on this or a linked account. */
		hasApp: boolean;
		onTab: (tab: 'info' | 'updates' | 'bracket') => void;
		/** The player accepted the rules; gets the fresh detail. */
		onChange?: (detail: TournamentDetail) => void;
	};

	let { me, match, hasApp, onTab, onChange }: Props = $props();
	const context = useTournament();
	const tournament = $derived(context.tournament);
	const { t } = useI18n();
	const host = useHost();

	type Step = {
		key: string;
		state: 'done' | 'current' | 'todo';
		title: string;
		text: string;
		actions?: { label: string; href?: string; onclick?: () => void; primary?: boolean }[];
	};

	let accepting = $state(false);

	const running = $derived(tournament.status === 'in_progress');
	const hasRules = $derived(tournament.rules.trim().length > 0);

	async function acceptRules() {
		if (accepting) {
			return;
		}

		accepting = true;
		try {
			const detail = await host.api.tournaments.acceptRules(tournament.id);
			host.notify.success(t('You accepted the rules.'));
			onChange?.(detail);
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			accepting = false;
		}
	}
	const date = (value: string | null) => {
		const iso = parseTournamentDate(value);
		return iso ? formatDate(iso, host.locale(), 'dateTime') : null;
	};

	const steps = $derived.by((): Step[] => {
		const download = hasApp ? undefined : host.routes.downloadApp?.();
		const starts = date(tournament.startsAt);
		const deadline = match?.match.deadline ? date(match.match.deadline) : null;
		const opponent = match?.opponent?.alias;
		return [
			{
				key: 'signed-up',
				state: 'done',
				title: t('You are signed up'),
				text: t('You play as {name}.', { name: me.alias })
			},
			hasRules && !me.rulesAccepted
				? {
						key: 'rules',
						state: 'current',
						title: t('Accept the rules'),
						text: tournament.rulesUpdatedAt
							? t('The rules changed. Read them again and accept them.')
							: t('Read the rules and accept them.'),
						actions: [
							{ label: t('Read the rules'), onclick: () => onTab('info') },
							{ label: t('Accept the rules'), onclick: acceptRules, primary: true }
						]
					}
				: {
						key: 'rules',
						state: hasRules || running ? 'done' : 'current',
						title: hasRules ? t('Rules accepted') : t('Read the rules'),
						text: t(
							'Map picks, factions, disconnects and no-shows: the rules say what is allowed.'
						),
						actions: [{ label: t('Read the rules'), onclick: () => onTab('info') }]
					},
			download
				? {
						key: 'app',
						state: 'current',
						title: t('Install the desktop app'),
						text: t(
							'Tournament games are started from the app, and it tells you when your match is ready.'
						),
						actions: [{ label: t('Download the app'), href: download }]
					}
				: {
						key: 'app',
						state: 'done',
						title: t('Desktop app ready'),
						text: t('You get a message here when your match is ready or something changes.')
					},
			running
				? {
						key: 'start',
						state: 'done',
						title: t('The tournament has started'),
						text: t('Follow the bracket and the updates for news from staff.'),
						actions: [{ label: t('View updates'), onclick: () => onTab('updates') }]
					}
				: {
						key: 'start',
						state: 'todo',
						title: t('Wait for the start'),
						text: starts
							? t('The tournament starts on {date}. We let you know when it starts.', {
									date: starts
								})
							: t('Staff announce the start. We let you know when it starts.')
					},
			{
				key: 'arrange',
				state: running && match ? 'current' : 'todo',
				title: t('Arrange your match'),
				text:
					running && match
						? deadline
							? t('Contact {name} on Steam and agree on a time before {date}.', {
									name: opponent ?? t('your opponent'),
									date: deadline
								})
							: t('Contact {name} on Steam and agree on a time.', {
									name: opponent ?? t('your opponent')
								})
						: t('Once your opponent is known, contact them on Steam and agree on a time.')
			},
			{
				key: 'play',
				state: running && match ? 'current' : 'todo',
				title: t('Start the tournament game'),
				text: t(
					'Click "Start tournament game" on the dashboard of the desktop app before you start the lobby, then play best of {count}.',
					{ count: match?.match.bestOf ?? tournament.bestOf }
				)
			},
			{
				key: 'result',
				state: 'todo',
				title: t('The result counts automatically'),
				text: t(
					'Relic reports the result. Did something go wrong, or did your opponent not show up? Use "Report a problem" at your match.'
				)
			}
		];
	});
</script>

<section class="border-secondary-800 border-b">
	<div class={flushHeader}>
		<p class={flushHeaderTitle}>{t('What we expect from you')}</p>
		<p class={flushHeaderDescription}>
			{t('Follow these steps and your games count without staff having to step in.')}
		</p>
	</div>
	<!-- Cells draw their own right and bottom line; the wrapper clips the outer ones and the
	     last row lands on the section's closing line, which also closes a short last row. -->
	<div class="-mb-px overflow-hidden">
		<ol class="-mr-px grid sm:grid-cols-2 xl:grid-cols-3">
			{#each steps as step, index (step.key)}
				<li class="border-secondary-800 flex gap-3 border-r border-b px-4 py-3">
					<span
						class={cn(
							'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
							step.state === 'done' && 'bg-success/15 text-success',
							step.state === 'current' && 'bg-primary text-gray-950',
							step.state === 'todo' && 'bg-secondary-800 text-secondary-400'
						)}
					>
						{#if step.state === 'done'}
							<CheckIcon size={16} weight="bold" />
						{:else}
							{index + 1}
						{/if}
					</span>
					<div class="flex min-w-0 flex-col items-start gap-1">
						<p
							class={cn(
								'font-semibold',
								step.state === 'todo' ? 'text-secondary-300' : 'text-white'
							)}
						>
							{step.title}
						</p>
						<p class="text-secondary-400 text-sm">{step.text}</p>
						{#if step.actions?.length}
							<div class="mt-1 flex flex-wrap gap-2">
								{#each step.actions as action (action.label)}
									<Button
										size="sm"
										variant={action.primary ? 'primary' : 'secondary'}
										href={action.href}
										target={action.href ? '_blank' : undefined}
										rel={action.href ? 'noopener noreferrer' : undefined}
										disabled={action.primary && accepting}
										loading={action.primary && accepting}
										onclick={action.onclick}
									>
										{action.label}
									</Button>
								{/each}
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	</div>
</section>
