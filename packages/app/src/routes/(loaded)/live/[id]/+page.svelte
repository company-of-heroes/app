<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { LiveLobby } from '$core/app/database/lobbies-live';
	import type { LobbiesLiveResponse, UsersResponse } from '$core/pocketbase/types';
	import type { UnsubscribeFunc } from 'pocketbase';
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '$core/app/context';
	import { liveLobbyToLobbyData } from '$core/game/lobby-utils';
	import CurrentGameView from '$lib/components/widgets/current-game-view.svelte';
	import { useI18n } from '$lib/i18n';
	import { resource, watch } from 'runed';

	type LiveLobbyRecord = LobbiesLiveResponse<
		LobbyPlayer[],
		{
			user: UsersResponse<string[], string[]>;
		}
	>;

	const { t } = useI18n();
	let unsubscribe = $state<UnsubscribeFunc>();
	let subscribeGeneration = 0;
	let loadErrorToastShown = $state(false);

	const lobby = resource(
		() => page.params.id,
		(id) => app.database.lobbiesLive.getOne(id!)
	);

	const match = $derived.by(() => {
		if (!lobby.current) return null;
		return liveLobbyToLobbyData(toLobbyRecord(lobby.current));
	});

	const isNotFound = $derived.by(() => {
		const error = lobby.error;
		if (!error) {
			return false;
		}

		return typeof error === 'object' && error !== null && 'status' in error
			? Number((error as { status: number }).status) === 404
			: false;
	});

	function toLobbyRecord(record: LiveLobby): LiveLobbyRecord {
		return {
			...record,
			expand: { user: record.user }
		} as unknown as LiveLobbyRecord;
	}

	watch(
		() => lobby.current?.lobby,
		(lobbyId) => {
			if (lobbyId) {
				void goto(`/history/${lobbyId}`, { replaceState: true });
			}
		}
	);

	watch(
		() => lobby.error,
		(error) => {
			if (!error || loadErrorToastShown) {
				return;
			}

			loadErrorToastShown = true;
			if (isNotFound) {
				app.toast.error(t('This live match is no longer available.'));
			} else {
				app.toast.error(t('Could not load this live match.'));
			}
		}
	);

	watch(
		() => page.params.id,
		(id) => {
			loadErrorToastShown = false;
			const generation = ++subscribeGeneration;

			void (async () => {
				await unsubscribe?.();
				if (generation !== subscribeGeneration) {
					return;
				}

				unsubscribe = undefined;
				if (!id) {
					return;
				}

				try {
					const next = await app.database.lobbiesLive.subscribe(id, (event) => {
						if (generation !== subscribeGeneration) {
							return;
						}

						if (event.action === 'delete') {
							app.toast.error(t('This live match is no longer available.'));
							void goto('/');
							return;
						}

						if (event.action === 'update') {
							app.database.lobbiesLive
								.getOne(event.record.id)
								.then((updated) => {
									if (generation !== subscribeGeneration) {
										return;
									}

									if (updated.lobby) {
										void goto(`/history/${updated.lobby}`, { replaceState: true });
										return;
									}

									lobby.mutate(updated);
								})
								.catch((error) => {
									console.warn('[LIVE]: failed to refresh live lobby:', error);
									app.toast.error(t('Could not load this live match.'));
								});
						}
					});

					if (generation !== subscribeGeneration) {
						await next?.();
						return;
					}

					unsubscribe = next;
				} catch (error) {
					console.warn('[LIVE]: subscribe failed:', error);
					app.toast.error(t('Could not load this live match.'));
				}
			})();
		}
	);

	onDestroy(() => {
		subscribeGeneration += 1;
		unsubscribe?.();
	});
</script>

{#if lobby.error}
	<div class="border-secondary-800 border-b px-4 py-6">
		<p class="text-red-400 text-sm">
			{isNotFound
				? t('This live match is no longer available.')
				: t('Could not load this live match.')}
		</p>
	</div>
{:else if match && !lobby.current?.lobby}
	{#key match}
		<CurrentGameView lobby={match} />
	{/key}
{/if}
