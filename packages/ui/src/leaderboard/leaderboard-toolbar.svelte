<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive, pageTab } from '@company-of-heroes/ui/variants';
	import { Input } from '@company-of-heroes/ui/input';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useHost } from '../host/host.context';
	import { useLeaderboard } from './context';
	import { boardIdForMode, getModeForBoard, LEADERBOARD_MODES } from './modes';

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	const activeMode = $derived(getModeForBoard(leaderboard.boardId));
</script>

<div class="border-secondary-800 flex flex-col border-b xl:flex-row xl:items-stretch">
	<div
		class="border-secondary-800 flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2.5 xl:border-r xl:border-b-0"
		role="tablist"
		aria-label={t('Mode')}
	>
		{#each LEADERBOARD_MODES as mode (mode.value)}
			<button
				type="button"
				role="tab"
				class={pageTab}
				aria-selected={activeMode.value === mode.value}
				data-state={activeMode.value === mode.value ? 'on' : undefined}
				onclick={() => leaderboard.selectBoard(boardIdForMode(mode, leaderboard.boardId))}
			>
				{t(mode.label)}
			</button>
		{/each}
	</div>
	<div
		class="border-secondary-800 divide-secondary-800 grid grid-cols-4 divide-x border-b xl:flex-1 xl:border-r xl:border-b-0"
		role="tablist"
		aria-label={t('Faction')}
	>
		{#each activeMode.factions as faction (faction.value)}
			{@const active = leaderboard.boardId === faction.value}
			<button
				type="button"
				role="tab"
				aria-selected={active}
				aria-label={t(faction.label)}
				class={cn(
					interactive,
					'relative flex min-w-0 items-center justify-center gap-2.5 px-3 py-2.5 font-bold transition-colors duration-150 sm:justify-start sm:px-4',
					'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5',
					active
						? 'bg-primary/5 text-primary after:bg-primary'
						: 'text-secondary-300 hover:bg-secondary-950/50 after:bg-transparent hover:text-white'
				)}
				onclick={() => leaderboard.selectBoard(faction.value)}
			>
				<img src={host.resolve.factionFlagByRace(faction.race)} alt="" class={factionIcon} />
				<span class="hidden truncate sm:inline">{t(faction.label)}</span>
			</button>
		{/each}
	</div>
	<!-- Same width as the side panel; the faction tabs' right border lines up with the table's. -->
	<div class="flex items-center px-4 py-2.5 xl:w-80">
		<Input
			type="search"
			size="sm"
			class="w-full"
			placeholder={t('Search player...')}
			aria-label={t('Search player...')}
			bind:value={leaderboard.filters.query}
		>
			{#snippet leading()}
				<MagnifyingGlassIcon class="size-4" />
			{/snippet}
		</Input>
	</div>
</div>
