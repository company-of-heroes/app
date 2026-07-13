<script lang="ts">
	import Side from './components/Side.svelte';
	import { getDevLobby } from './lib/test-data';
	import { prepareLobbyData } from './lib/lobby';
	import {
		connectLobby,
		DEV_SCENARIOS,
		getDevScenarioFromUrl,
		getUserIdFromPath,
		type DevScenario
	} from './lib/lobby-feed';
	import type { LobbyData } from './lib/types';

	let liveLobbyData = $state<LobbyData | null>(null);
	let devScenario = $state<DevScenario>(import.meta.env.DEV ? getDevScenarioFromUrl() : '4v4');
	const userId = getUserIdFromPath();
	const isDevPreview = import.meta.env.DEV && !userId;
	const debugPoll = $derived(new URLSearchParams(window.location.search).has('debugPoll'));
	let pollStatus = $state<{ last?: number; count?: number }>({});

	if (userId) {
		connectLobby(userId, (data) => {
			liveLobbyData = data ? prepareLobbyData(data) : null;
		});
	}

	const lobbyData = $derived(
		isDevPreview ? prepareLobbyData(getDevLobby(devScenario)) : liveLobbyData
	);

	$effect(() => {
		if (!isDevPreview) return;
		document.documentElement.style.background = '#fff';
		document.body.style.background = '#fff';
		return () => {
			document.documentElement.style.background = '';
			document.body.style.background = '';
		};
	});

	$effect(() => {
		if (!debugPoll) return;
		const tick = () => {
			const w = window as unknown as Record<string, unknown>;
			const last = typeof w.__oppbotPollLast === 'number' ? w.__oppbotPollLast : undefined;
			const count = typeof w.__oppbotPollCount === 'number' ? w.__oppbotPollCount : undefined;
			pollStatus = { last, count };
		};
		tick();
		const id = window.setInterval(tick, 500);
		return () => window.clearInterval(id);
	});

	function setDevScenario(scenario: DevScenario) {
		devScenario = scenario;
		const url = new URL(window.location.href);
		url.searchParams.set('dev', scenario);
		window.history.replaceState({}, '', url);
	}
</script>

{#if lobbyData?.teams}
	<div class="manifest">
		<div class="manifest__field">
			{#each lobbyData.teams as team, index (index)}
				<Side
					{team}
					{index}
					matchType={lobbyData.matchType}
					meId={lobbyData.me?.playerId}
				/>
			{/each}
		</div>
	</div>
{/if}

{#if isDevPreview}
	<div class="dev-picker">
		{#each DEV_SCENARIOS as scenario (scenario)}
			<button
				type="button"
				class="dev-picker__btn"
				class:dev-picker__btn--active={devScenario === scenario}
				onclick={() => setDevScenario(scenario)}
			>
				{scenario}
			</button>
		{/each}
	</div>
{/if}

{#if debugPoll}
	<div class="debug-poll">
		poll: {pollStatus.count ?? 0} • last: {pollStatus.last ? new Date(pollStatus.last).toLocaleTimeString() : '—'}
	</div>
{/if}

<style>
	.dev-picker {
		position: fixed;
		right: 12px;
		bottom: 12px;
		display: flex;
		gap: 6px;
		padding: 6px;
		border-radius: 8px;
		background: rgba(18, 16, 14, 0.92);
		border: 1px solid #4a4438;
	}

	.dev-picker__btn {
		cursor: pointer;
		padding: 4px 10px;
		border: 1px solid #2e2a24;
		border-radius: 4px;
		background: #1a1714;
		color: rgba(236, 230, 216, 0.72);
		font:
			500 12px/1.2 'IBM Plex Mono',
			monospace;
	}

	.dev-picker__btn--active {
		border-color: #c4a24a;
		color: #ece6d8;
		background: #2e2a24;
	}

	.debug-poll {
		position: fixed;
		left: 10px;
		bottom: 10px;
		z-index: 9999;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.9);
		color: #111;
		font: 500 12px/1.2 var(--font-data);
		border: 1px solid rgba(0, 0, 0, 0.15);
	}
</style>
