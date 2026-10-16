<script lang="ts">
	import CountryFlag from '../player/country-flag.svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useHost, type PlayerSearchOption } from '../host/host.context';
	import { getCachedPlayerPreview } from '../player/player-preview-cache';
	import { Button } from '../ui/button';
	import TournamentPlayerSearch from './tournament-player-search.svelte';

	type Props = {
		/** Steam ids, in the order they were added; signed up after the tournament is created. */
		value: string[];
		/** Maximum players of the tournament, or null for no limit. */
		max?: number | null;
		disabled?: boolean;
	};

	let { value = $bindable([]), max = null, disabled = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	type Known = { alias: string; avatarUrl?: string | null; country?: string | null };

	let known = $state<Record<string, Known | null>>({});
	const full = $derived(!!max && value.length >= max);

	function add(player: PlayerSearchOption) {
		if (value.includes(player.value) || full || disabled) {
			return;
		}

		const id = player.value;
		value = [...value, id];
		if (player.label !== id) {
			known[id] = { alias: player.label, avatarUrl: player.avatarUrl, country: player.country };
			return;
		}

		void getCachedPlayerPreview(id, host.api.players.getPreview)
			.catch(() => null)
			.then((preview) => {
				known[id] = preview;
			});
	}

	function remove(id: string) {
		value = value.filter((entry) => entry !== id);
	}
</script>

<div class="flex max-w-md flex-col gap-3">
	<TournamentPlayerSearch exclude={value} disabled={disabled || full} onPick={add} class="w-fit" />
	{#if full}
		<p class="text-secondary-400 text-xs">{t('The list is at the maximum number of players.')}</p>
	{/if}
	{#if value.length}
		<ul class="border-secondary-800 divide-secondary-800 divide-y rounded-md border">
			{#each value as id (id)}
				{@const preview = known[id]}
				<li class="flex items-center gap-2 px-3 py-1.5 text-sm">
					{#if preview?.avatarUrl}
						<img
							loading="lazy"
							decoding="async"
							src={host.resolve.avatarUrl(preview.avatarUrl, { thumb: '100x100' })}
							alt=""
							class="size-6 shrink-0 rounded object-cover"
						/>
					{/if}
					<CountryFlag country={preview?.country} class="h-3.5" />
					<span class="min-w-0 flex-1 truncate text-white">
						{preview?.alias || id}
						{#if preview?.alias}
							<span class="text-secondary-500 ml-1 text-xs tabular-nums">{id}</span>
						{/if}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t('Remove')}
						{disabled}
						onclick={() => remove(id)}
					>
						<XIcon size={14} />
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
