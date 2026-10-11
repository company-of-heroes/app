<script lang="ts">
	import { PlayerSearchResults } from '@company-of-heroes/ui/player';
	import type { Snapshot } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { relic } from '$lib/relic';
	import { goto } from '$app/navigation';
	import { isProfileId, isSteamId } from '$lib/utils';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useI18n } from '$lib/i18n';

	type SearchState = { input: string; query: string };

	const { t } = useI18n();
	let input = $state('');
	/** The submitted name; the results below search for it. */
	let query = $state('');
	let resolving = $state(false);
	let error = $state<string | null>(null);
	const canSearch = $derived(input.trim().length > 0 && !resolving);

	async function search(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = input.trim();
		if (!trimmed) {
			return;
		}

		error = null;
		if (!isSteamId(trimmed) && !isProfileId(trimmed)) {
			query = trimmed;
			return;
		}

		resolving = true;
		try {
			const profile = await relic.resolveProfile(trimmed);
			if (!profile) {
				error = t('Player not found');
				return;
			}

			await goto(`/players/${profile.profile_id}`);
		} catch {
			error = t('Failed to search for player');
		} finally {
			resolving = false;
		}
	}

	export const snapshot: Snapshot<SearchState> = {
		capture: () => ({ input, query }),
		restore: (state) => {
			input = state.input;
			query = state.query;
		}
	};
</script>

<Form.Root onsubmit={search}>
	<Form.Group
		inputId="player-search"
		label={t('Find a player')}
		description={t('Search for a player by Steam ID, profile ID, or in-game name.')}
	>
		<Input
			id="player-search"
			type="text"
			autocomplete="off"
			placeholder={t('Steam ID, profile ID, or player name')}
			bind:value={input}
			disabled={resolving}
			aria-label={t('Find a player')}
		/>
		<Button
			type="submit"
			variant="secondary"
			class="w-fit shrink-0"
			loading={resolving}
			disabled={!canSearch}
		>
			<MagnifyingGlassIcon size={16} />
			{t('Search')}
		</Button>
	</Form.Group>
</Form.Root>

{#if error}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{error}</Alert>
	</div>
{:else if query}
	{#key query}
		<PlayerSearchResults {query} />
	{/key}
{/if}
