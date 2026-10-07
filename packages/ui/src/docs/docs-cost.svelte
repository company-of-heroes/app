<script lang="ts">
	import type { DocCost } from '@company-of-heroes/game-data/types';
	import ActionCostChips from '../replay/action-cost-chips.svelte';

	type Props = {
		cost?: DocCost;
		/** Population; shown with the pop cap icon. */
		pop?: number;
		/** Leave out the build / research time. */
		hideTime?: boolean;
		class?: string;
	};

	let { cost, pop, hideTime = false, class: className }: Props = $props();
</script>

<!-- The same cost chips as the stats and replay popovers. -->
<ActionCostChips
	cost={{ ...cost, popcap: pop, seconds: hideTime ? undefined : cost?.seconds }}
	class={className}
/>
