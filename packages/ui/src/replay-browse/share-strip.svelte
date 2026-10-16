<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { accentBlock } from '@company-of-heroes/ui/variants';
	import ShareNetworkIcon from 'phosphor-svelte/lib/ShareNetworkIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import MapImage from '../ui/map-image.svelte';
	import { displayMapName } from '../replay/links';
	import type { CommunityMatch } from '../replay/types';
	import { teamOutcome, teamPlayers } from '../replay/utils';
	import { matchupLabel, unixSeconds } from './utils';

	type Props = {
		matches: CommunityMatch[];
		meSteamIds?: string[];
		/** Where "Share" goes for a match (the publish-from-match upload page). */
		shareHref: (match: CommunityMatch) => string;
	};

	const DISMISSED_KEY = 'replays:share-strip-dismissed';

	const { t } = useI18n();
	const host = useHost();

	let { matches, meSteamIds = [], shareHref }: Props = $props();

	let dismissed = $state<string[]>(readDismissed());

	/** Ids hidden by an earlier dismiss; a per-viewer convenience, so failures just show the strip. */
	function readDismissed(): string[] {
		try {
			const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
			return Array.isArray(value) ? value.map(String) : [];
		} catch {
			return [];
		}
	}

	const visible = $derived(matches.filter((match) => !dismissed.includes(match.id)));

	function dismiss() {
		dismissed = [...new Set([...dismissed, ...matches.map((match) => match.id)])].slice(-50);
		try {
			localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
		} catch {
			// Private mode or blocked storage: the strip simply returns next time.
		}
	}

	function myOutcome(match: CommunityMatch): 'win' | 'loss' | null {
		for (const side of ['allies', 'axis'] as const) {
			const mine = teamPlayers(match, side).some(
				(player) => !!player.steamId && meSteamIds.includes(player.steamId)
			);
			if (mine) {
				return teamOutcome(match, side);
			}
		}

		return null;
	}

	function when(match: CommunityMatch) {
		const seconds = unixSeconds(match.createdAt);
		return seconds ? formatRelative(seconds, host.locale()) : '';
	}
</script>

{#if visible.length > 0}
	<section class={cn(accentBlock, 'border-secondary-800 border-b')}>
		<div class="flex items-start justify-between gap-4 px-4 pt-4 pb-3">
			<div class="flex min-w-0 items-center gap-3">
				<ShareNetworkIcon class="text-primary size-6 shrink-0" weight="duotone" />
				<div class="min-w-0">
					<h2 class="font-heading font-bold text-white">{t('Share your latest matches')}</h2>
					<p class="text-secondary-300 text-sm">
						{t(
							'These games have a replay nobody has shared yet. One click and everyone can watch them.'
						)}
					</p>
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-secondary-400 shrink-0 hover:text-white"
				aria-label={t('Hide')}
				onclick={dismiss}
			>
				<XIcon class="size-4" />
			</Button>
		</div>
		<div class="overflow-hidden">
			<div class="-mr-px grid sm:grid-cols-2 xl:grid-cols-4">
				{#each visible as match (match.id)}
					{@const outcome = myOutcome(match)}
					{@const matchup = matchupLabel(match)}
					<div
						class="border-secondary-800/70 flex min-w-0 items-center gap-3 border-t border-r px-4 py-3"
					>
						<MapImage
							map={match.map}
							resolveMapSrc={host.resolve.mapSrc}
							resolveFallbackSrc={host.resolve.mapFallbackSrc}
							alt=""
							small
							flush
							class="size-12 rounded-md"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium text-white">{displayMapName(match.map, host)}</p>
							<p class="text-secondary-400 flex items-center gap-1.5 truncate text-xs">
								{#if matchup}
									<span>{matchup}</span>
									<span class="text-secondary-600">·</span>
								{/if}
								{#if outcome}
									<span class={outcome === 'win' ? 'text-green-300' : 'text-red-300'}>
										{outcome === 'win' ? t('Victory') : t('Defeat')}
									</span>
									<span class="text-secondary-600">·</span>
								{/if}
								<span>{when(match)}</span>
							</p>
						</div>
						<Button href={shareHref(match)} variant="secondary" size="sm" class="shrink-0">
							<ShareNetworkIcon class="size-4" />
							{t('Share')}
						</Button>
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}
