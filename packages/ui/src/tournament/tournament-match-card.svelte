<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVerticalIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import { useHost } from '../host/host.context';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { formatDate } from '../format/date';
	import { deadlineState, parseTournamentDate, timeLeft } from './format';
	import type { TournamentMatch, TournamentParticipant, TournamentSlot } from './types';
	import { useTournament } from './context';
	import { tooltip } from '../attachments';
	import TournamentDragItem, { type DragItem } from './tournament-drag-item.svelte';

	type Props = {
		match: TournamentMatch;
		/** Staff: opens the result dialog. */
		onEdit?: (match: TournamentMatch) => void;
		/** Staff, inside a drag provider: players in unplayed matches can be dragged onto each other. */
		swappable?: boolean;
		class?: string;
	};

	let { match, onEdit, swappable = false, class: className }: Props = $props();
	const context = useTournament();
	const participants = $derived(context.participantsById);
	const revealGames = $derived(context.revealGames);
	const { t } = useI18n();
	const host = useHost();

	const dead = $derived(match.bye && !match.playerA && !match.playerB);
	const editable = $derived(
		Boolean(onEdit) && !match.bye && Boolean(match.playerA && match.playerB)
	);
	const mine = $derived(
		[match.playerA, match.playerB].some(
			(id) => id && participants.get(id)?.user === host.auth.user?.id
		)
	);
	const showGames = $derived(revealGames || mine || !!host.auth.user?.isStaff);
	const deadline = $derived(deadlineState(match));
	/** Unplayed (the server checks the same): players here can still change places. */
	const open = $derived(
		match.status !== 'completed' &&
			match.games.length === 0 &&
			!match.playing &&
			match.bracket !== 'round_robin'
	);
</script>

{#snippet slot(id: string | null, side: TournamentSlot)}
	{@const player = id ? participants.get(id) : undefined}
	{#if swappable}
		<TournamentDragItem
			id="{match.id}:{side}"
			label={player?.alias ?? ''}
			disabled={!open || !player}
		>
			{#snippet children(item)}
				{@render row(id, side, open && player ? item : null)}
			{/snippet}
		</TournamentDragItem>
	{:else}
		{@render row(id, side, null)}
	{/if}
{/snippet}

{#snippet row(id: string | null, side: TournamentSlot, item: DragItem | null)}
	{@const player = id ? participants.get(id) : undefined}
	{@const won = !!match.winner && match.winner === id}
	{@const lost = !!match.winner && !!id && match.winner !== id}
	<div
		{@attach (node) => item?.attach(node)}
		class={cn(
			'flex h-8 items-center gap-2 px-2 text-sm transition-colors',
			side === 'B' && 'border-secondary-800 border-t',
			lost && 'text-secondary-500',
			won && 'font-semibold text-white',
			item?.source && 'opacity-50',
			item?.target && 'bg-primary/15 ring-primary/60 ring-1 ring-inset'
		)}
	>
		{#if item}
			<button
				type="button"
				{@attach item.handle}
				class="text-secondary-500 hover:text-secondary-200 -ml-1 shrink-0 cursor-grab touch-none active:cursor-grabbing"
				aria-label={t('Drag to swap with another player')}
				{@attach tooltip(t('Drag to swap with another player'))}
			>
				<DotsSixVerticalIcon size={14} />
			</button>
		{/if}
		<span class="text-secondary-500 w-5 shrink-0 text-right text-xs tabular-nums">
			{player?.seed ?? ''}
		</span>
		{#if player}
			<PlayerProfileLink
				href={host.routes.player(player.profileId)}
				class={cn(interactive, 'hover:text-primary min-w-0 flex-1 truncate')}
			>
				{player.alias}
			</PlayerProfileLink>
			{#if player.status === 'disqualified'}
				<span class="text-destructive text-xs">{t('DQ')}</span>
			{/if}
		{:else}
			<span class="text-secondary-600 min-w-0 flex-1 truncate italic">
				{match.bye ? t('Bye') : t('TBD')}
			</span>
		{/if}
		{#if !match.bye}
			<span class={cn('w-4 shrink-0 text-right tabular-nums', won && 'text-primary')}>
				{side === 'A' ? match.winsA : match.winsB}
			</span>
		{/if}
	</div>
{/snippet}

<div
	class={cn(
		'border-secondary-800 bg-secondary-950/60 w-56 rounded-md border',
		match.status === 'ready' && 'border-secondary-600',
		mine && match.status !== 'completed' && 'border-primary/60',
		dead && 'invisible',
		className
	)}
	aria-hidden={dead || undefined}
>
	{@render slot(match.playerA, 'A')}
	{@render slot(match.playerB, 'B')}
	{#if !match.bye}
		<div
			class="border-secondary-800 text-secondary-500 flex h-7 items-center gap-1.5 border-t px-2 text-xs"
		>
			<span>{t('Bo{count}', { count: match.bestOf })}</span>
			{#if match.status === 'ready' && match.playing}
				<Badge variant="destructive" pulse class="shrink-0">{t('LIVE')}</Badge>
			{:else if match.status === 'ready' && deadline === 'overdue'}
				<span class="text-destructive">· {t('Overdue')}</span>
			{:else if match.status === 'ready' && match.scheduledAt}
				{@const startsAt = formatDate(
					parseTournamentDate(match.scheduledAt),
					host.locale(),
					'dateTime'
				)}
				<span class="text-primary min-w-0 truncate" {@attach tooltip(startsAt)}>
					· {t('Starts {date}', { date: startsAt })}
				</span>
			{:else if match.status === 'ready' && deadline === 'soon' && match.deadline}
				<span class="text-warning">· {t('{time} left', { time: timeLeft(t, match.deadline) })}</span
				>
			{:else if match.status === 'ready'}
				<span class="text-success">· {t('Ready to play')}</span>
			{/if}
			{#if match.manual}
				<span {@attach tooltip(t('Result set by staff'))}>· {t('Staff')}</span>
			{/if}
			<span class="ml-auto flex items-center gap-1">
				{#each showGames ? match.games : [] as game, index (game.lobbyId)}
					<a
						href={host.routes.match(game.lobbyId)}
						class={cn(interactive, 'hover:text-primary tabular-nums')}
						{@attach tooltip(t('Game {number}', { number: index + 1 }))}
					>
						{t('G{number}', { number: index + 1 })}
					</a>
				{/each}
				{#if editable}
					<Button
						variant="ghost"
						size="icon-sm"
						class="size-5"
						aria-label={t('Edit result')}
						onclick={() => onEdit?.(match)}
					>
						<PencilSimpleIcon size={12} />
					</Button>
				{/if}
			</span>
		</div>
	{/if}
</div>
