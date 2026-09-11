<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { href, useI18n } from '$lib/i18n';
	import { isPlayerId } from '$lib/utils/player/steam-id';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { watch } from 'runed';
	import type { Snippet } from 'svelte';

	type Props = {
		initialQuery?: string;
		hint?: Snippet;
		class?: string;
		/** Compact chrome-less field for home; leave off on /players. */
		prominent?: boolean;
	};

	let { initialQuery = '', hint, class: className, prominent = false }: Props = $props();
	const { t } = useI18n();

	let query = $state('');
	let validationError = $state<string | null>(null);
	const pending = $derived(
		Boolean(navigating.to?.params?.id) || Boolean(navigating.to?.url.searchParams.get('q'))
	);
	const canSearch = $derived(query.trim().length > 0 && !pending);

	watch(
		() => initialQuery,
		(value) => {
			query = value;
		}
	);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = query.trim();
		if (!trimmed) {
			validationError = t('Enter a Steam ID64, Relic profile id, or player name.');
			return;
		}

		validationError = null;
		if (isPlayerId(trimmed)) {
			void goto(href(`/players/${trimmed}`));
			return;
		}

		void goto(href(`/players?q=${encodeURIComponent(trimmed)}`));
	}
</script>

{#snippet searchControls()}
	<Input
		id="player-search"
		type="text"
		autocomplete="off"
		placeholder={t('Steam ID, profile ID, or player name')}
		bind:value={query}
		disabled={pending}
		aria-label={t('Find a player')}
		class={prominent ? 'min-w-0 flex-1' : undefined}
	/>
	<Button
		type="submit"
		variant={prominent ? 'primary' : 'secondary'}
		class="w-fit shrink-0"
		loading={pending}
		disabled={!canSearch}
	>
		<MagnifyingGlassIcon size={16} />
		{t('Search')}
	</Button>
{/snippet}

<Form.Root onsubmit={handleSubmit}>
	{#if prominent}
		<div class="flex w-full min-w-0 max-w-2xl flex-wrap items-center gap-3">
			{@render searchControls()}
		</div>
	{:else}
		<Form.Group
			inputId="player-search"
			label={t('Find a player')}
			description={t('Search for a player by Steam ID, profile ID, or in-game name.')}
			{hint}
			class={className}
		>
			{@render searchControls()}
		</Form.Group>
	{/if}
	{#if validationError}
		<p
			class="text-destructive {prominent
				? 'mt-2 text-sm'
				: 'border-secondary-800 border-b px-4 py-2 text-sm'}"
		>
			{validationError}
		</p>
	{/if}
</Form.Root>
