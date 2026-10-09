<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import { SvelteSet } from 'svelte/reactivity';
	import { countryDisplayName } from '../format/country';
	import { getEloColor, getEloTextShadow, isEliteElo } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import TournamentParticipantStats from './tournament-participant-stats.svelte';
	import type { TournamentParticipant } from './types';
	import { useTournament } from './context';
	import { escapeHtml, tooltip } from '../attachments';

	type Props = {
		/** Staff, before the start: move players up and down; `onReorder` gets the new order. */
		onReorder?: (order: TournamentParticipant[]) => void;
		/** Staff, while running: disqualify a player. */
		onDisqualify?: (participant: TournamentParticipant) => void;
		showPlacement?: boolean;
		/** Staff: mark players who did not accept the current rules. */
		showRules?: boolean;
		/** The page is saving: the seed buttons wait. */
		busy?: boolean;
	};

	let {
		onReorder,
		onDisqualify,
		showPlacement = false,
		showRules = false,
		busy = false
	}: Props = $props();
	const context = useTournament();
	const participants = $derived(context.participants);
	const { t } = useI18n();
	const host = useHost();

	const rows = $derived(
		showPlacement
			? [...participants].sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999))
			: participants
	);
	const numbered = $derived(rows.some((row) => (showPlacement ? row.placement : row.seed) != null));
	const numberLabel = $derived(showPlacement ? t('Place') : numbered ? t('Seed') : '#');

	const placementClass = (place: number | null) =>
		place === 1
			? 'text-primary'
			: place === 2
				? 'text-secondary-200'
				: place === 3
					? 'text-warning'
					: 'text-secondary-400';

	const expanded = new SvelteSet<string>();
	const columns = $derived(onReorder || onDisqualify ? 5 : 4);

	function toggle(id: string) {
		if (expanded.has(id)) {
			expanded.delete(id);
		} else {
			expanded.add(id);
		}
	}

	/** Row click toggles the stats, unless a link or button inside the row was clicked. */
	function onRowClick(event: MouseEvent, id: string) {
		if ((event.target as HTMLElement).closest('a, button')) {
			return;
		}

		toggle(id);
	}

	function move(index: number, by: -1 | 1) {
		const order = [...participants];
		const [row] = order.splice(index, 1);
		order.splice(index + by, 0, row);
		onReorder?.(order);
	}
</script>

{#if rows.length === 0}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Nobody signed up yet.')}
	</p>
{:else}
	<div class="border-secondary-800 overflow-x-auto border-b">
		<table class="w-full table-fixed border-collapse text-sm">
			<thead>
				<tr class="{tableHeadRow} text-center">
					<th class="w-16 px-4 py-2">{numberLabel}</th>
					<th class="px-4 py-2 text-left">{t('Player')}</th>
					<th class="w-36 px-4 py-2 whitespace-nowrap">{t('Highest ELO')}</th>
					{#if onReorder || onDisqualify}
						<th class="w-36 px-4 py-2"><span class="sr-only">{t('Actions')}</span></th>
					{/if}
					<th class="w-44 px-2 py-2"><span class="sr-only">{t('Stats')}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as participant, index (participant.id)}
					{@const number = showPlacement ? participant.placement : participant.seed}
					{@const isYou = participant.user === host.auth.user?.id}
					{@const out = participant.status !== 'registered'}
					{@const flagUrl = host.resolve.flagImageUrl(participant.country)}
					{@const countryName = countryDisplayName(participant.country, host.locale())}
					{@const open = expanded.has(participant.id)}
					<tr
						onclick={(event) => onRowClick(event, participant.id)}
						class={cn(
							'border-secondary-800/70 hover:bg-secondary-950/50 h-11 cursor-pointer border-t text-white',
							open && 'bg-secondary-950/50',
							isYou &&
								'bg-primary/5 hover:bg-primary/10 shadow-[inset_2px_0_0_var(--color-primary)]'
						)}
					>
						<td
							class={cn(
								'px-4 py-1.5 text-center font-semibold tabular-nums',
								showPlacement ? placementClass(number) : 'text-secondary-400'
							)}
						>
							{number ?? index + 1}
						</td>
						<td class="px-4 py-1.5">
							<div class="flex min-w-0 items-center gap-2">
								<span
									class={cn(
										'flex min-w-0 items-center gap-2 font-medium',
										out && 'text-secondary-500 line-through'
									)}
								>
									{#if flagUrl}
										<img
											class="h-4 w-auto shrink-0 rounded-xs"
											src={flagUrl}
											alt={countryName ?? participant.country}
											{@attach tooltip(escapeHtml(countryName ?? ''))}
										/>
									{/if}
									<span class="truncate">{participant.alias}</span>
								</span>
								{#if isYou}
									<Badge class="shrink-0">
										{t('You')}
									</Badge>
								{/if}
								{#if participant.status === 'disqualified'}
									<Badge variant="destructive" class="shrink-0">
										{t('Disqualified')}
									</Badge>
								{/if}
								{#if showRules && !participant.rulesAccepted && !out}
									<Badge variant="warning" class="shrink-0">
										{t('Rules not accepted')}
									</Badge>
								{/if}
							</div>
						</td>
						<td
							class={cn(
								'px-4 py-1.5 text-center tabular-nums',
								participant.highestRating == null && 'text-secondary-500 text-xs font-normal',
								isEliteElo(participant.highestRating) && 'font-bold tracking-wide'
							)}
							style:color={participant.highestRating != null
								? getEloColor(participant.highestRating)
								: undefined}
							style:text-shadow={getEloTextShadow(participant.highestRating)}
						>
							{participant.highestRating ?? t('N/A')}
						</td>
						{#if onReorder || onDisqualify}
							<td class="px-4">
								<div class="flex justify-end gap-1">
									{#if onReorder}
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t('Move up')}
											disabled={busy || index === 0}
											onclick={() => move(index, -1)}
										>
											<ArrowUpIcon size={14} />
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t('Move down')}
											disabled={busy || index === rows.length - 1}
											onclick={() => move(index, 1)}
										>
											<ArrowDownIcon size={14} />
										</Button>
									{/if}
									{#if onDisqualify && participant.status === 'registered'}
										<Button variant="ghost" size="sm" onclick={() => onDisqualify?.(participant)}>
											{t('Disqualify')}
										</Button>
									{/if}
								</div>
							</td>
						{/if}
						<td class="px-2 py-1.5">
							<div class="flex items-center justify-end gap-1">
								<Button
									variant="secondary"
									size="sm"
									href={host.routes.player(participant.profileId)}
								>
									{t('View profile')}
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-expanded={open}
									aria-label={open ? t('Hide stats') : t('Show stats')}
									onclick={() => toggle(participant.id)}
								>
									<CaretDownIcon
										size={14}
										class={cn('transition-transform', open && 'rotate-180')}
									/>
								</Button>
							</div>
						</td>
					</tr>
					{#if open}
						<tr class="border-secondary-800 border-t">
							<td colspan={columns} class="bg-secondary-950/30 p-0">
								<TournamentParticipantStats
									playerId={participant.steamId || String(participant.profileId)}
								/>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
