<script module lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { LeaderboardBoard } from '@company-of-heroes/ui/leaderboard';

	/** Last loaded board per id, shown at once on a tab switch while the board refreshes. */
	const lastBoards = new SvelteMap<number, LeaderboardBoard>();
</script>

<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { resource } from 'runed';
	import { DEFAULT_BOARD_ID, LeaderboardPage } from '@company-of-heroes/ui/leaderboard';
	import { api } from '$core/api';

	let boardId = $state(DEFAULT_BOARD_ID);

	const loaded = resource(
		() => boardId,
		async (id): Promise<LeaderboardBoard | null> => {
			const result = await api.leaderboards.get(id);
			if (result.isErr()) {
				console.error('[LEADERBOARD]: board failed:', result.error);
				return null;
			}

			lastBoards.set(id, result.value);
			return result.value;
		},
		{ initialValue: null }
	);

	const board = $derived(
		loaded.current?.leaderboardId === boardId ? loaded.current : (lastBoards.get(boardId) ?? null)
	);

	export const snapshot: Snapshot<number> = {
		capture: () => boardId,
		restore: (id) => {
			boardId = id;
		}
	};
</script>

<LeaderboardPage {boardId} {board} onBoardChange={(id) => (boardId = id)} />
