<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge, LiveBadge } from '@company-of-heroes/ui/badge';
	import { Button } from '@company-of-heroes/ui/button';
	import { cn } from '@company-of-heroes/ui/cn';
	import { Checkbox, Select } from '@company-of-heroes/ui/input';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		flushSectionTitle,
		interactive,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import type { TournamentMatch } from '@company-of-heroes/api/tournaments';
	import type { SimActionName, SimStep } from '$lib/server/services/dev-tournament-sim';
	import { href, useI18n } from '$lib/i18n';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import ArrowUUpLeftIcon from 'phosphor-svelte/lib/ArrowUUpLeftIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import FastForwardIcon from 'phosphor-svelte/lib/FastForwardIcon';
	import PlayIcon from 'phosphor-svelte/lib/PlayIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';
	import type { PageProps } from './$types';

	type FlowAction = Exclude<SimActionName, 'create' | 'runAll' | 'reset'>;
	type TimelineStep = SimStep & { id: number };

	let { data }: PageProps = $props();
	const { t } = useI18n();

	const API = '/api/dev/tournaments/sim';
	const FLOW: FlowAction[] = [
		'register',
		'rulesChange',
		'close',
		'start',
		'feature',
		'schedule',
		'report',
		'overdue',
		'playMatch',
		'disqualify',
		'playRound',
		'finish'
	];
	const STEP_LABELS: Record<SimActionName, string> = {
		create: t('Create'),
		register: t('Sign up'),
		rulesChange: t('Change the rules'),
		close: t('Close registration'),
		start: t('Start'),
		feature: t('Feature a match'),
		schedule: t('Schedule a match'),
		report: t('Report a problem'),
		overdue: t('Overdue match'),
		playMatch: t('Play a match'),
		disqualify: t('Disqualify a player'),
		playRound: t('Play a round'),
		finish: t('Play to the end'),
		runAll: t('Run everything'),
		reset: t('Reset all')
	};
	const BRACKET: Record<TournamentMatch['bracket'], string> = {
		winners: 'W',
		losers: 'L',
		grand_final: 'GF',
		round_robin: 'RR'
	};

	let players = $state('8');
	let format = $state('double_elim');
	let bestOf = $state('1');
	let includeMe = $state(false);
	let running = $state<SimActionName | null>(null);
	let failure = $state<string | null>(null);
	let timeline = $state.raw<TimelineStep[]>([]);
	let nextId = 0;

	const overview = $derived(data.overview);
	const current = $derived(overview?.current ?? null);
	const slug = $derived(current?.detail.tournament.slug ?? null);
	const checks = $derived(timeline.flatMap((step) => step.checks));
	const passed = $derived(checks.filter((check) => check.ok).length);
	const aliases = $derived(new Map(current?.detail.participants.map((p) => [p.id, p.alias]) ?? []));
	const notifications = $derived(new Map(current?.players.map((p) => [p.participantId, p]) ?? []));

	const playerItems = ['4', '8', '16'].map((value) => ({ value, label: value }));
	const formatItems = $derived([
		{ value: 'single_elim', label: t('Single elimination') },
		{ value: 'double_elim', label: t('Double elimination') },
		{ value: 'round_robin', label: t('Round robin') }
	]);
	const bestOfItems = [
		{ value: '1', label: 'Bo1' },
		{ value: '3', label: 'Bo3' }
	];

	function at(value: string | null) {
		return value ? new Date(value.replace(' ', 'T')).toLocaleString() : '—';
	}

	function matchLabel(match: TournamentMatch) {
		return `${BRACKET[match.bracket]}${match.round}.${match.position}`;
	}

	function alias(id: string | null) {
		return (id && aliases.get(id)) || t('TBD');
	}

	async function open(nextSlug: string | null) {
		await goto(
			nextSlug ? href(`/tournaments/simulate?slug=${nextSlug}`) : href('/tournaments/simulate'),
			{
				replaceState: true,
				noScroll: true,
				keepFocus: true,
				invalidateAll: true
			}
		);
	}

	async function act(action: SimActionName, body: Record<string, unknown> = {}) {
		running = action;
		failure = null;
		try {
			const response = await fetch(API, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, ...body })
			});
			const result = await response.json();
			if (!response.ok) {
				failure = result.message ?? t('Something went wrong. Please try again later.');
				return;
			}

			const steps = (result.steps as SimStep[]).map((step) => ({ ...step, id: ++nextId }));
			timeline = [...steps.toReversed(), ...timeline];
			await open(action === 'reset' ? null : (steps.findLast((step) => step.slug)?.slug ?? slug));
		} catch (cause) {
			failure = cause instanceof Error ? cause.message : String(cause);
		} finally {
			running = null;
		}
	}

	function createOptions() {
		return { players: Number(players), format, bestOf: Number(bestOf), includeMe };
	}

	async function viewAs(userId: string) {
		const response = await fetch(`${API}/view-as`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ userId })
		});
		if (!response.ok) {
			failure = (await response.json()).message;
			return;
		}

		window.location.assign(slug ? href(`/tournaments/${slug}`) : href('/'));
	}

	async function backToMine() {
		const response = await fetch(`${API}/view-as`, { method: 'DELETE' });
		if (!response.ok) {
			failure = (await response.json()).message;
		}

		window.location.reload();
	}
</script>

<svelte:head>
	<title>{t('Tournament simulator')} | {t('Company of Heroes 1 Stats')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class={flushHeader}>
	<h1 class={flushSectionTitle}>{t('Tournament simulator')}</h1>
	<p class={flushHeaderDescription}>
		{t(
			'Local development only. Bots play a whole tournament through the real services, with checks after every step.'
		)}
	</p>
</div>

{#if data.viewingAs}
	<div class="border-secondary-800 flex flex-wrap items-center gap-3 border-b px-4 py-3">
		<EyeIcon size={18} class="text-primary" />
		<p class="text-secondary-200 flex-1 text-sm">
			{t('You are viewing the site as {name}.', {
				name: data.viewingAs.name || data.viewingAs.email
			})}
		</p>
		<Button size="sm" onclick={backToMine}>
			<ArrowUUpLeftIcon size={16} />
			{t('Back to my account')}
		</Button>
	</div>
	{#if failure}
		<p class="text-destructive px-4 py-3 text-sm">{failure}</p>
	{/if}
{:else if overview}
	<div class="lg:divide-secondary-800 -mb-px grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:divide-x">
		<div class="[&>*]:border-secondary-800 [&>*]:border-b">
			<section>
				<div class={flushHeader}>
					<h2 class={flushHeaderTitle}>{t('New simulation')}</h2>
				</div>
				<div class="grid gap-3 px-4 py-3">
					<label class="grid gap-1 text-sm">
						<span class="text-secondary-400">{t('Players')}</span>
						<Select
							type="single"
							size="sm"
							bind:value={players}
							items={playerItems}
							aria-label={t('Players')}
						/>
					</label>
					<label class="grid gap-1 text-sm">
						<span class="text-secondary-400">{t('Format')}</span>
						<Select
							type="single"
							size="sm"
							bind:value={format}
							items={formatItems}
							aria-label={t('Format')}
						/>
					</label>
					<label class="grid gap-1 text-sm">
						<span class="text-secondary-400">{t('Best of')}</span>
						<Select
							type="single"
							size="sm"
							bind:value={bestOf}
							items={bestOfItems}
							aria-label={t('Best of')}
						/>
					</label>
					<Checkbox bind:checked={includeMe} label={t('I play along (my linked Steam account)')} />
					<div class="flex flex-wrap gap-2">
						<Button
							size="sm"
							disabled={!!running}
							loading={running === 'create'}
							onclick={() => act('create', { options: createOptions() })}
						>
							<PlusIcon size={16} />
							{t('Create')}
						</Button>
						<Button
							size="sm"
							variant="secondary"
							disabled={!!running}
							loading={running === 'runAll'}
							onclick={() => act('runAll', { options: createOptions() })}
						>
							<FastForwardIcon size={16} />
							{t('Run everything')}
						</Button>
					</div>
				</div>
			</section>

			<section>
				<div
					class="border-secondary-800 flex items-center justify-between gap-3 border-b px-4 py-3"
				>
					<h2 class={flushHeaderTitle}>{t('Simulations')}</h2>
					<Button
						size="sm"
						variant="destructive"
						disabled={!!running}
						loading={running === 'reset'}
						onclick={() => act('reset')}
					>
						<TrashIcon size={16} />
						{t('Reset all')}
					</Button>
				</div>
				{#if overview.tournaments.length === 0}
					<p class="text-secondary-500 px-4 py-3 text-sm">{t('No simulations yet.')}</p>
				{:else}
					<ul class="-mb-px">
						{#each overview.tournaments as row (row.id)}
							<li
								class={cn(
									'border-secondary-800 flex items-center gap-2 border-b px-4 py-2 text-sm',
									row.slug === slug && 'bg-primary/5'
								)}
							>
								<a
									class={cn(interactive, 'flex-1 truncate text-white hover:underline')}
									href={href(`/tournaments/simulate?slug=${row.slug}`)}
								>
									{row.name}
								</a>
								<Badge class="shrink-0">{row.status}</Badge>
								<a
									class={cn(interactive, 'text-secondary-400 hover:text-white')}
									href={href(`/tournaments/${row.slug}`)}
									title={t('Open the tournament page')}
								>
									<ArrowSquareOutIcon size={16} />
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
			<section>
				<div
					class="border-secondary-800 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
				>
					<h2 class={flushHeaderTitle}>{t('Steps')}</h2>
					{#if checks.length > 0}
						<Badge variant={passed === checks.length ? 'success' : 'destructive'}>
							{t('{passed}/{total} checks passed', { passed, total: checks.length })}
						</Badge>
					{/if}
				</div>
				{#if slug}
					<div class="flex flex-wrap gap-2 px-4 py-3">
						{#each FLOW as action (action)}
							<Button
								size="sm"
								variant="secondary"
								disabled={!!running}
								loading={running === action}
								onclick={() => act(action, { slug })}
							>
								<PlayIcon size={14} />
								{STEP_LABELS[action]}
							</Button>
						{/each}
					</div>
				{:else}
					<p class="text-secondary-500 px-4 py-3 text-sm">
						{t('Create a simulation or pick one from the list.')}
					</p>
				{/if}
				{#if failure}
					<p class="text-destructive border-secondary-800 border-t px-4 py-3 text-sm">{failure}</p>
				{/if}
			</section>

			{#if timeline.length > 0}
				<section>
					<div class={flushHeader}>
						<h2 class={flushHeaderTitle}>{t('Timeline')}</h2>
					</div>
					<ul class="-mb-px">
						{#each timeline as step (step.id)}
							<li class="border-secondary-800 border-b">
								<details open={!step.ok}>
									<summary class={cn(interactive, 'flex items-center gap-3 px-4 py-2 text-sm')}>
										<Badge variant={step.ok ? 'success' : 'destructive'} class="shrink-0">
											{step.ok ? t('Pass') : t('Fail')}
										</Badge>
										<span class="flex-1 font-medium text-white">{STEP_LABELS[step.step]}</span>
										{#if step.slug}
											<span class="text-secondary-500">{step.slug}</span>
										{/if}
										<span class="text-secondary-400 tabular-nums">
											{step.checks.filter((check) => check.ok).length}/{step.checks.length}
										</span>
									</summary>
									<ul class="border-secondary-800 border-t px-4 py-2 text-sm">
										{#each step.checks as check, i (i)}
											<li class="flex items-start gap-2 py-0.5">
												{#if check.ok}
													<CheckCircleIcon
														size={16}
														weight="fill"
														class="text-success mt-0.5 shrink-0"
													/>
												{:else}
													<XCircleIcon
														size={16}
														weight="fill"
														class="text-destructive mt-0.5 shrink-0"
													/>
												{/if}
												<span class={check.ok ? 'text-secondary-200' : 'text-destructive'}
													>{check.label}</span
												>
												{#if check.detail}
													<span class="text-secondary-500 min-w-0 break-words"
														>— {check.detail}</span
													>
												{/if}
											</li>
										{/each}
									</ul>
									{#if step.log.length > 0}
										<pre
											class="border-secondary-800 text-secondary-400 overflow-x-auto border-t px-4 py-2 text-xs">{step.log.join(
												'\n'
											)}</pre>
									{/if}
								</details>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if current}
				{@const detail = current.detail}
				<section>
					<div class="border-secondary-800 flex flex-wrap items-center gap-3 border-b px-4 py-3">
						<h2 class={flushHeaderTitle}>{detail.tournament.name}</h2>
						<Badge>{detail.tournament.status}</Badge>
						<span class="text-secondary-400 text-sm">
							{detail.tournament.format} · Bo{detail.tournament.bestOf} · {t(
								'Live games: {count}',
								{
									count: detail.tournament.liveCount
								}
							)}
						</span>
						<span class="text-secondary-400 text-sm">
							{t('Your notifications: {count}', { count: current.staffNotifications.count })}
						</span>
						<a
							class={cn(
								interactive,
								'text-primary ml-auto flex items-center gap-1 text-sm hover:underline'
							)}
							href={href(`/tournaments/${detail.tournament.slug}`)}
						>
							{t('Open the tournament page')}
							<ArrowSquareOutIcon size={14} />
						</a>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class={tableHeadRow}>
									<th class="px-4 py-2 text-left">{t('Player')}</th>
									<th class="px-2 py-2 text-left">{t('Seed')}</th>
									<th class="px-2 py-2 text-left">{t('Status')}</th>
									<th class="px-2 py-2 text-left">{t('Rules')}</th>
									<th class="px-2 py-2 text-left">{t('Notifications')}</th>
									<th class="px-4 py-2"></th>
								</tr>
							</thead>
							<tbody>
								{#each detail.participants as p (p.id)}
									{@const extra = notifications.get(p.id)}
									<tr class="border-secondary-800 border-b last:border-b-0">
										<td class="px-4 py-1.5 text-white">
											{p.alias}
											{#if extra?.me}
												<span class="text-primary text-xs">({t('you')})</span>
											{/if}
										</td>
										<td class="px-2 py-1.5 tabular-nums">{p.seed ?? '—'}</td>
										<td class="px-2 py-1.5">{p.status}{p.placement ? ` · #${p.placement}` : ''}</td>
										<td class="px-2 py-1.5">
											{#if p.rulesAccepted}
												<CheckCircleIcon size={16} weight="fill" class="text-success" />
											{:else}
												<XCircleIcon size={16} weight="fill" class="text-destructive" />
											{/if}
										</td>
										<td
											class="px-2 py-1.5 tabular-nums"
											title={extra?.notifications.latest.join('\n')}
										>
											{extra?.notifications.count ?? 0}
										</td>
										<td class="px-4 py-1.5 text-right">
											{#if extra?.bot}
												<Button size="sm" variant="ghost" onclick={() => viewAs(p.user)}>
													<EyeIcon size={14} />
													{t('View as')}
												</Button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>

				{#if detail.matches.length > 0}
					<section>
						<div class={flushHeader}>
							<h2 class={flushHeaderTitle}>{t('Matches')}</h2>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class={tableHeadRow}>
										<th class="px-4 py-2 text-left">{t('Match')}</th>
										<th class="px-2 py-2 text-left">{t('Players')}</th>
										<th class="px-2 py-2 text-left">{t('Score')}</th>
										<th class="px-2 py-2 text-left">{t('Status')}</th>
										<th class="px-2 py-2 text-left">{t('Scheduled')}</th>
										<th class="px-4 py-2 text-left">{t('Deadline')}</th>
									</tr>
								</thead>
								<tbody>
									{#each detail.matches as match (match.id)}
										<tr class="border-secondary-800 border-b last:border-b-0">
											<td class="px-4 py-1.5 tabular-nums">
												{matchLabel(match)}
												{#if match.id === detail.tournament.featuredMatch}
													<Badge class="ml-1">{t('Featured')}</Badge>
												{/if}
											</td>
											<td class="px-2 py-1.5 text-white">
												{match.bye
													? t('Bye')
													: `${alias(match.playerA)} vs ${alias(match.playerB)}`}
											</td>
											<td class="px-2 py-1.5 tabular-nums">{match.winsA}–{match.winsB}</td>
											<td class="px-2 py-1.5">
												<span class="flex items-center gap-2">
													{match.status}
													{#if match.playing}
														<LiveBadge />
													{/if}
												</span>
											</td>
											<td class="px-2 py-1.5">{at(match.scheduledAt)}</td>
											<td class="px-4 py-1.5">{at(match.deadline)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}

				{#if current.reports.length > 0}
					<section>
						<div class={flushHeader}>
							<h2 class={flushHeaderTitle}>{t('Reports')}</h2>
						</div>
						<ul class="-mb-px">
							{#each current.reports as report (report.id)}
								<li
									class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
								>
									<Badge variant={report.status === 'open' ? 'warning' : 'success'}
										>{report.status}</Badge
									>
									<span class="text-white">{report.reporter.name}</span>
									<span class="text-secondary-400">{report.reason}: {report.message}</span>
									{#if report.staffNote}
										<span class="text-secondary-500">— {report.staffNote}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if detail.posts.length > 0}
					<section>
						<div class={flushHeader}>
							<h2 class={flushHeaderTitle}>{t('Updates')}</h2>
						</div>
						<ul class="-mb-px">
							{#each detail.posts as post (post.id)}
								<li
									class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
								>
									<Badge variant={post.important ? 'warning' : 'default'}>{post.kind}</Badge>
									<span class="text-white">{post.title || '—'}</span>
									<span class="text-secondary-500 ml-auto">{at(post.created)}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<section class="text-secondary-400 flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-sm">
					<span>{t('Tournament games: {count}', { count: current.claims.length })}</span>
					<span>{t('Hidden sessions: {count}', { count: current.hiddenSessions.length })}</span>
					<span>{t('Schedules: {count}', { count: current.schedules.length })}</span>
				</section>
			{/if}
		</div>
	</div>
{/if}
