<script lang="ts">
	import type { DocWeapon } from '@company-of-heroes/game-data/types';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import DocsWeaponStats from './docs-weapon-stats.svelte';

	type Props = {
		weapon: DocWeapon;
	};

	let { weapon }: Props = $props();
	const host = useHost();
</script>

<!-- A weapon as in the stats popover: its name, then chips and range bars. -->
<section>
	<a
		href={host.href(`/wiki/weapons/${weapon.slug}`)}
		class={cn(
			interactive,
			flushHeader,
			'bg-secondary-950/90 hover:text-primary block text-sm font-semibold text-white transition-colors'
		)}
	>
		{weapon.name}
	</a>
	<DocsWeaponStats {weapon} />
</section>
