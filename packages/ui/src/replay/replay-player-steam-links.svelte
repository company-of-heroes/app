<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Selection } from '../ui/input';
	import { Button } from '../ui/button';
	import { cn } from '../cn';
	import { factionIcon } from '../variants';
	import { useHost } from '../host/host.context';
	import { raceFromReplayFaction } from './replay-stats';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { tooltip } from '../attachments';

	export type ReplaySteamLinkPlayer = {
		/** Stable row key (slot / index). */
		key: string;
		name: string;
		faction?: string;
		steamId: string | null;
		/** Display label when linked (search alias or existing name). */
		linkedLabel?: string | null;
		avatarUrl?: string | null;
		country?: string | null;
		profileId?: number | null;
	};

	export type ReplaySteamLinkOption = {
		value: string;
		label: string;
		avatarUrl?: string | null;
		country?: string | null;
		profileId?: number | null;
	};

	type KnownProfile = {
		label: string;
		avatarUrl?: string | null;
		country?: string | null;
		profileId?: number | null;
	};

	type SelectionOption = {
		value: string;
		label: string;
		meta?: Record<string, string>;
	};

	type Props = {
		players: ReplaySteamLinkPlayer[];
		onLink: (
			key: string,
			steamId: string | null,
			label?: string | null,
			meta?: {
				avatarUrl?: string | null;
				country?: string | null;
				profileId?: number | null;
			}
		) => void;
		class?: string;
	};

	let { players, onLink, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const STEAM_ID = /^7656119\d{10}$/;

	let knownProfiles = $state.raw<Record<string, KnownProfile>>({});

	function factionRace(faction: string | undefined) {
		return raceFromReplayFaction(String(faction || ''));
	}

	function parseProfileId(raw: string | undefined): number | null {
		if (!raw) {
			return null;
		}

		const id = Number(raw);
		return Number.isFinite(id) && id > 0 ? id : null;
	}

	function optionMeta(
		avatarUrl?: string | null,
		country?: string | null,
		profileId?: number | null
	): Record<string, string> | undefined {
		const meta: Record<string, string> = {};
		if (avatarUrl) {
			meta.avatarUrl = avatarUrl;
		}

		if (country) {
			meta.country = country;
		}

		if (profileId && profileId > 0) {
			meta.profileId = String(profileId);
		}

		return Object.keys(meta).length > 0 ? meta : undefined;
	}

	function toSelectionOption(option: ReplaySteamLinkOption): SelectionOption {
		return {
			value: option.value,
			label: option.label,
			meta: optionMeta(option.avatarUrl, option.country, option.profileId)
		};
	}

	function profileFor(player: ReplaySteamLinkPlayer): KnownProfile | null {
		if (player.steamId && knownProfiles[player.steamId]) {
			return knownProfiles[player.steamId];
		}

		if (player.linkedLabel?.trim() || player.avatarUrl || player.country || player.profileId) {
			return {
				label: player.linkedLabel?.trim() || player.steamId || player.name,
				avatarUrl: player.avatarUrl,
				country: player.country,
				profileId: player.profileId
			};
		}

		if (player.steamId) {
			return { label: player.steamId, profileId: player.profileId };
		}

		return null;
	}

	function displayLabel(player: ReplaySteamLinkPlayer) {
		return profileFor(player)?.label ?? t('Search player...');
	}

	function playerHref(steamId: string, profileId?: number | null) {
		return host.routes.player(profileId && profileId > 0 ? profileId : steamId);
	}

	/** Search people with matches; a raw SteamID64 is always offered when nothing matches. */
	async function searchPlayers(query: string): Promise<ReplaySteamLinkOption[]> {
		const q = query.trim();
		if (!q) {
			return [];
		}

		const results = await host.api.players.search(q).catch(() => []);
		if (results.length > 0) {
			return results;
		}

		return STEAM_ID.test(q)
			? [{ value: q, label: q, avatarUrl: null, country: null, profileId: null }]
			: [];
	}

	function optionsFor(player: ReplaySteamLinkPlayer): SelectionOption[] {
		if (!player.steamId) {
			return [];
		}

		const profile = profileFor(player);
		return [
			toSelectionOption({
				value: player.steamId,
				label: displayLabel(player),
				avatarUrl: profile?.avatarUrl,
				country: profile?.country,
				profileId: profile?.profileId
			})
		];
	}

	async function search(query: string): Promise<SelectionOption[]> {
		const results = await searchPlayers(query);
		const next = { ...knownProfiles };
		for (const option of results) {
			next[option.value] = {
				label: option.label,
				avatarUrl: option.avatarUrl,
				country: option.country,
				profileId: option.profileId
			};
		}
		knownProfiles = next;
		return results.map(toSelectionOption);
	}

	function onValueChange(player: ReplaySteamLinkPlayer, value: string | string[]) {
		const steamId = Array.isArray(value) ? (value[0] ?? '') : value;
		if (!steamId) {
			onLink(player.key, null, null);
			return;
		}

		const profile = knownProfiles[steamId];
		onLink(player.key, steamId, profile?.label ?? null, {
			avatarUrl: profile?.avatarUrl,
			country: profile?.country,
			profileId: profile?.profileId
		});
	}

	function clear(player: ReplaySteamLinkPlayer) {
		onLink(player.key, null, null);
	}

	function avatarSrc(url: string | null | undefined) {
		if (!url) {
			return null;
		}

		return host.resolve.avatarUrl(url);
	}

	function flagSrc(country: string | null | undefined) {
		return country ? host.resolve.flagImageUrl(country) : null;
	}

	function stopSelect(event: Event) {
		event.stopPropagation();
	}
</script>

{#snippet optionRow({ option }: { option: SelectionOption })}
	{@const avatar = avatarSrc(option.meta?.avatarUrl)}
	{@const flag = flagSrc(option.meta?.country)}
	{@const href = playerHref(option.value, parseProfileId(option.meta?.profileId))}
	<span class="flex min-w-0 flex-1 items-center gap-3">
		{#if avatar}
			<img
				src={avatar}
				alt=""
				class="ring-secondary-700 size-8 shrink-0 rounded-md object-cover ring-1"
			/>
		{:else}
			<span class="bg-secondary-800 ring-secondary-700 size-8 shrink-0 rounded-md ring-1"></span>
		{/if}
		{#if flag}
			<img class="h-4 w-auto shrink-0 rounded-xs" src={flag} alt={option.meta?.country ?? ''} />
		{/if}
		<span class="min-w-0 flex-1 truncate">{option.label}</span>
		{#if href}
			<Button
				{href}
				target="_blank"
				rel="noopener noreferrer"
				variant="secondary"
				size="icon-sm"
				class="shrink-0"
				aria-label={t('View profile')}
				{@attach tooltip(t('View profile'))}
				onpointerdown={stopSelect}
				onmousedown={stopSelect}
				onclick={stopSelect}
			>
				<ArrowSquareOutIcon class="size-4" weight="bold" />
			</Button>
		{/if}
	</span>
{/snippet}

{#if players.length > 0}
	<section class={cn('border-secondary-800', className)}>
		<div class="px-4 py-3">
			<h2 class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
				{t('Players')}
			</h2>
			{#if t('Link a Steam account when the replay has no Steam ID so ratings and flags can load.')}
				<p class="text-secondary-400 mt-1 text-sm">
					{t('Link a Steam account when the replay has no Steam ID so ratings and flags can load.')}
				</p>
			{/if}
		</div>
		<ul class="border-secondary-800 bg-secondary-800/30 divide-secondary-800 divide-y border-t">
			{#each players as player (player.key)}
				{@const profile = profileFor(player)}
				{@const rowAvatar = avatarSrc(profile?.avatarUrl)}
				{@const rowFlag = flagSrc(profile?.country)}
				{@const href = player.steamId
					? playerHref(player.steamId, profile?.profileId ?? null)
					: null}
				<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
					<div class="flex min-w-0 flex-1 items-center gap-2.5">
						<img
							src={host.resolve.factionFlagByRace(factionRace(player.faction))}
							alt=""
							class={factionIcon}
						/>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-white">{player.name}</p>
							{#if player.steamId}
								<p class="text-secondary-400 flex min-w-0 items-center gap-1.5 truncate text-xs">
									{#if rowAvatar}
										<img src={rowAvatar} alt="" class="size-4 shrink-0 rounded-sm object-cover" />
									{/if}
									{#if rowFlag}
										<img
											class="h-3 w-auto shrink-0 rounded-xs"
											src={rowFlag}
											alt={profile?.country ?? ''}
										/>
									{/if}
									<span class="truncate">{t('Linked')}: {displayLabel(player)}</span>
								</p>
							{/if}
						</div>
					</div>
					<div class="ml-auto flex min-w-0 items-center gap-2">
						<div class="w-44 shrink-0 sm:w-48">
							<Selection
								value={player.steamId ?? ''}
								options={optionsFor(player)}
								placeholder={t('Search player...')}
								searchPlaceholder={t('Search player...')}
								noResultsLabel={t('No results found.')}
								searchingLabel={t('Searching...')}
								onSearch={search}
								onValueChange={(value) => onValueChange(player, value)}
								getDisplayLabel={(option) => option.label}
								renderOption={optionRow}
								size="sm"
								variant="secondary"
								class="w-full"
							/>
						</div>
						{#if player.steamId && href}
							<Button
								{href}
								target="_blank"
								rel="noopener noreferrer"
								variant="secondary"
								size="sm"
								class="shrink-0"
								aria-label={t('View profile')}
							>
								<ArrowSquareOutIcon class="size-4" weight="bold" />
								{t('View profile')}
							</Button>
						{/if}
						{#if player.steamId}
							<Button
								type="button"
								variant="secondary"
								size="icon-sm"
								class="shrink-0"
								aria-label={t('Clear')}
								onclick={() => clear(player)}
							>
								<XIcon class="size-4" weight="bold" />
							</Button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}
