<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeaderTitle } from '@company-of-heroes/ui/variants';
	import IdentificationCardIcon from 'phosphor-svelte/lib/IdentificationCardIcon';
	import MedalIcon from 'phosphor-svelte/lib/MedalIcon';
	import MedalMilitaryIcon from 'phosphor-svelte/lib/MedalMilitaryIcon';
	import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon';
	import { useHost } from '../host/host.context';
	import PlayerSupporterMedal from '../player/player-supporter-medal.svelte';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const medalUrl = host.resolve.supporterMedal();

	const perks = $derived([
		{
			key: 'medal',
			icon: MedalIcon,
			title: t('Supporter medal'),
			text: t('A medal next to your name across coh1stats.')
		},
		{
			key: 'ribbons',
			icon: MedalMilitaryIcon,
			title: t('Supporter ribbons'),
			text: t('Ribbons that unlock as your supporter months add up. They stay with you.')
		},
		{
			key: 'card',
			icon: IdentificationCardIcon,
			title: t('Player card'),
			text: t('A shareable card with your best ELO and rank per army, as a page and a PNG.')
		},
		{
			key: 'page',
			icon: UsersThreeIcon,
			title: t('Your name on this page'),
			text: t('Listed under current supporters, and in the hall of fame when you stop.')
		}
	]);
</script>

<!-- Flush grid: every cell draws its right and bottom line, the grid overhangs by 1px on the right. -->
<div class={cn('overflow-hidden', className)}>
	<ul class="-mr-px grid sm:grid-cols-2 lg:grid-cols-4">
		{#each perks as perk (perk.key)}
			<li class="border-secondary-800 flex flex-col gap-2 border-r border-b px-4 py-4">
				<span class="text-primary flex items-center gap-2">
					{#if perk.key === 'medal' && medalUrl}
						<PlayerSupporterMedal force size={22} />
					{:else}
						<perk.icon size={20} weight="duotone" class="shrink-0" />
					{/if}
					<span class={flushHeaderTitle}>{perk.title}</span>
				</span>
				<p class="text-secondary-400 text-sm">{perk.text}</p>
			</li>
		{/each}
	</ul>
</div>
