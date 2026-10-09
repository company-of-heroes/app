<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { Badge } from '../ui/badge';
	import type { PlayerSteamBans } from './types';
	import { tooltip } from '../attachments';

	type Props = {
		bans: PlayerSteamBans;
		class?: string;
	};

	let { bans, class: className }: Props = $props();
	const { t } = useI18n();

	const counts = $derived(
		[
			bans.vacBans === 1
				? t('1 VAC ban')
				: bans.vacBans > 1
					? t('{count} VAC bans', { count: bans.vacBans })
					: null,
			bans.gameBans === 1
				? t('1 game ban')
				: bans.gameBans > 1
					? t('{count} game bans', { count: bans.gameBans })
					: null
		].filter(Boolean)
	);
	const lastBan = $derived(
		bans.daysSinceLastBan === 0
			? t('last ban today')
			: t('last ban {days} days ago', { days: bans.daysSinceLastBan })
	);
</script>

<Badge
	variant="destructive"
	class={cn('shrink-0', className)}
	{@attach tooltip(t('Steam ban history'))}
>
	<span>{counts.join(' · ')}</span>
	<span class="text-secondary-400">· {lastBan}</span>
</Badge>
