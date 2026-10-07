<script lang="ts">
	import { loadReplayStats, type ReplayStats } from '@company-of-heroes/game-data/replay';
	import { useHost } from '../host/host.context';
	import { actionIconKey } from '../replay/action-icons';
	import { lookupActionInfo, type loadActionInfo } from '../replay/replay-action-info';
	import { blueprintCost } from '../replay/replay-costs';
	import CommandTree from './command-tree.svelte';

	type Props = {
		/** Doctrine pick (its lock upgrade id). */
		doctrine: number;
		/** In-game names and descriptions, loaded by the popover. */
		infoTable: Awaited<ReturnType<typeof loadActionInfo>> | undefined;
		class?: string;
	};

	let { doctrine, infoTable, class: className }: Props = $props();
	const host = useHost();

	let stats = $state<ReplayStats>();
	$effect(() => {
		void loadReplayStats().then((table) => (stats = table));
	});

	function icon(id: number): string | undefined {
		const key = actionIconKey({ objectID: id, command: { type: 'DOCTRINAL' } });
		return key ? host.resolve.actionIcon(key) : undefined;
	}

	const branches = $derived(
		(stats?.doctrines[doctrine] ?? []).map((branch) =>
			branch.map((id) => {
				const info = lookupActionInfo(infoTable, { list: 'upgrade', objectID: id });
				return {
					key: String(id),
					name: info?.name ?? '',
					help: info?.help,
					icon: icon(id),
					command: blueprintCost({ list: 'upgrade', objectID: id })?.command
				};
			})
		)
	);
</script>

<CommandTree {branches} class={className} />
