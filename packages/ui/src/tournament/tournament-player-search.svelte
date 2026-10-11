<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost, type PlayerSearchOption } from '../host/host.context';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { Button } from '../ui/button';
	import { Selection } from '../ui/input';

	type Option = { value: string; label: string; meta?: Record<string, string> };

	type Props = {
		/** A player was picked from the results. */
		onPick: (player: PlayerSearchOption) => void;
		/** Steam ids that are already in; left out of the results. */
		exclude?: string[];
		disabled?: boolean;
		class?: string;
	};

	let { onPick, exclude = [], disabled = false, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const STEAM_ID = /^7656119\d{10}$/;

	let picked = $state('');
	let open = $state(false);
	let found: Record<string, PlayerSearchOption> = {};

	/** Players with matches by alias or Steam id; a raw Steam id is offered when nothing matches. */
	async function search(query: string): Promise<Option[]> {
		const q = query.trim();
		if (!q) {
			return [];
		}

		let results = await host.api.players.search(q).catch(() => []);
		if (results.length === 0 && STEAM_ID.test(q)) {
			results = [{ value: q, label: q }];
		}

		found = Object.fromEntries(results.map((result) => [result.value, result]));
		return results
			.filter((result) => !exclude.includes(result.value))
			.map((result) => ({
				value: result.value,
				label: result.label,
				meta: {
					avatarUrl: result.avatarUrl ?? '',
					country: result.country ?? ''
				}
			}));
	}

	function pick(value: string | string[]) {
		const steamId = Array.isArray(value) ? (value[0] ?? '') : value;
		picked = '';
		const player = found[steamId];
		if (player) {
			onPick(player);
		}
	}
</script>

{#snippet optionRow({ option }: { option: Option })}
	{@const flagUrl = option.meta?.country ? host.resolve.flagImageUrl(option.meta.country) : null}
	<span class="flex min-w-0 flex-1 items-center gap-3">
		{#if option.meta?.avatarUrl}
			<img
				loading="lazy"
				decoding="async"
				src={host.resolve.avatarUrl(option.meta.avatarUrl, { thumb: '100x100' })}
				alt=""
				class="ring-secondary-700 size-8 shrink-0 rounded-md object-cover ring-1"
			/>
		{:else}
			<span class="bg-secondary-800 ring-secondary-700 size-8 shrink-0 rounded-md ring-1"></span>
		{/if}
		{#if flagUrl}
			<img
				loading="lazy"
				decoding="async"
				class="h-4 w-auto shrink-0 rounded-xs"
				src={flagUrl}
				alt={option.meta?.country ?? ''}
			/>
		{/if}
		<span class="min-w-0 flex-1 truncate">{option.label}</span>
		{#if option.label !== option.value}
			<span class="text-secondary-500 shrink-0 text-xs tabular-nums">{option.value}</span>
		{/if}
	</span>
{/snippet}

<Button variant="secondary" size="sm" {disabled} class={className} onclick={() => (open = true)}>
	<PlusIcon size={16} />
	{t('Add player')}
</Button>
<Selection
	bind:value={picked}
	bind:open
	hideTrigger
	options={[]}
	{disabled}
	placeholder={t('Search player or Steam ID...')}
	searchPlaceholder={t('Search player or Steam ID...')}
	noResultsLabel={t('No results found.')}
	searchingLabel={t('Searching...')}
	selectOptionLabel={t('Add player')}
	onSearch={search}
	onValueChange={pick}
	renderOption={optionRow}
/>
