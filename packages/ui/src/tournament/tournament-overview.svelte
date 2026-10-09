<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle, tableHeadText } from '@company-of-heroes/ui/variants';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { untrack } from 'svelte';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { StaffSection } from '../ui/staff-section';
	import TournamentHostCta from './tournament-host-cta.svelte';
	import TournamentHostRequestsDialog from './tournament-host-requests-dialog.svelte';
	import TournamentList from './tournament-list.svelte';
	import TournamentMyMatch from './tournament-my-match.svelte';
	import type { MyTournamentMatch, Tournament } from './types';

	type Props = {
		active: Tournament[];
		upcoming: Tournament[];
		past: Tournament[];
	};

	let { active, upcoming, past }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let myMatches = $state.raw<MyTournamentMatch[]>([]);
	// `?hostRequests=1` from a staff notification opens the host requests.
	let hostRequestsOpen = $state(untrack(() => host.url.param('hostRequests') === '1'));
	let pendingHosts = $state(0);

	// Staff: the open requests for the button's count. Untracked: a remote command on the website.
	$effect(() => {
		if (host.auth.user?.isStaff) {
			untrack(() => {
				host.api.tournaments
					.hostRequests()
					.then((list) => (pendingHosts = list.filter((r) => r.status === 'pending').length))
					.catch(() => {});
			});
		}
	});

	// The signed-in player's open matches (deadlines, played games, replays).
	// Untracked: on the website `mine()` is a remote command whose own state would loop this effect.
	$effect(() => {
		if (!host.auth.user) {
			myMatches = [];
			return;
		}

		untrack(refresh);
	});

	/** Load (or reload after propose / accept / report) the signed-in player's open matches. */
	function refresh() {
		host.api.tournaments
			.mine()
			.then((mine) => (myMatches = mine.matches))
			.catch(() => {});
	}
</script>

<header class="border-secondary-800 relative isolate shrink-0 overflow-hidden border-b">
	<div
		class="from-primary/15 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
	></div>
	<TrophyIcon
		weight="duotone"
		class="text-primary/5 pointer-events-none absolute -top-6 right-4 -z-10 hidden size-56 sm:block"
	/>
	<div
		class="flex flex-col gap-6 px-4 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-14"
	>
		<div class="flex min-w-0 flex-col gap-2">
			<span class={cn(tableHeadText, 'text-primary')}>{t('Community')}</span>
			<h1 class="font-heading text-3xl leading-tight font-bold text-white sm:text-4xl">
				{t('Tournaments')}
			</h1>
			<p class="text-secondary-400 max-w-2xl text-sm">
				{t(
					'1v1 tournaments run by staff and community hosts. Sign up, play your matches and follow the bracket.'
				)}
			</p>
		</div>
		<div class="flex shrink-0 flex-wrap items-center gap-2">
			<Button href={host.routes.tournamentHallOfFame()} variant="secondary">
				<CrownIcon size={16} weight="fill" />
				{t('Hall of fame')}
			</Button>
			{#if host.auth.user?.canHost}
				<Button href={host.routes.tournamentNew()}>
					<PlusIcon size={16} />
					{t('New tournament')}
				</Button>
			{/if}
		</div>
	</div>
</header>

{#if host.auth.user?.isStaff}
	<StaffSection class="border-t-0 border-b" contentClass="flex flex-wrap items-center gap-2 py-2.5">
		<Button variant="secondary" size="sm" onclick={() => (hostRequestsOpen = true)}>
			{t('Host requests')}
			{#if pendingHosts > 0}
				<Badge variant="warning">{pendingHosts}</Badge>
			{/if}
		</Button>
	</StaffSection>
	<TournamentHostRequestsDialog
		open={hostRequestsOpen}
		onClose={() => (hostRequestsOpen = false)}
		onCount={(count) => (pendingHosts = count)}
	/>
{:else}
	<TournamentHostCta />
{/if}

{#snippet section(title: string, count: number, live = false)}
	<div class={cn(flushHeader, 'flex items-center gap-2')}>
		{#if live}
			<span class="relative flex size-2">
				<span class="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75"
				></span>
				<span class="bg-primary relative inline-flex size-2 rounded-full"></span>
			</span>
		{/if}
		<p class={flushHeaderTitle}>{title}</p>
		{#if count > 0}
			<span class="text-secondary-500 text-xs tabular-nums">{count}</span>
		{/if}
	</div>
{/snippet}

{#if myMatches.length}
	{@render section(t('Your matches'), myMatches.length, true)}
	<TournamentMyMatch items={myMatches} onChange={refresh} />
{/if}

{@render section(t('In progress'), active.length, active.length > 0)}
<TournamentList tournaments={active} emptyMessage={t('No tournament is running right now.')} />

{@render section(t('Upcoming'), upcoming.length)}
<TournamentList tournaments={upcoming} emptyMessage={t('No upcoming tournaments.')} />

{@render section(t('Past tournaments'), past.length)}
<TournamentList tournaments={past} compact emptyMessage={t('No past tournaments yet.')} />
