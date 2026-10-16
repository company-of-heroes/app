<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import LockIcon from 'phosphor-svelte/lib/LockIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import { cn } from '../cn';
	import { formatDate } from '../format/date';
	import { tryUseHost } from '../host/host.context';
	import { tooltipPanel } from '../variants';
	import { formatRewardCondition } from './metrics';
	import { ribbonTipHtml } from './ribbon';
	import type { RewardView } from './types';

	type Props = {
		reward: RewardView;
		/** Faded with a lock; defaults to not unlocked yet. The wiki shows rewards plainly. */
		locked?: boolean;
		class?: string;
	};

	let { reward, locked: lockedProp, class: className }: Props = $props();
	const locked = $derived(lockedProp ?? !reward.unlockedAt);
	const { t } = useI18n();
	const host = tryUseHost();
	const lockedImage = 'opacity-35 grayscale';
	const ribbon = $derived(
		reward.ribbon
			? (host?.resolve.ribbons().find((item) => item.key === reward.ribbon) ?? null)
			: null
	);

	/**
	 * Unlock date, or for a locked reward "Locked" plus the owner's progress per condition. Without
	 * progress (a visitor, or an account the viewer does not own) it is just "Locked".
	 */
	const statusLines = $derived.by((): string[] => {
		if (reward.unlockedAt) {
			return [formatDate(reward.unlockedAt, host?.locale() ?? 'en', 'date', { timeZone: 'UTC' })];
		}

		if (!locked) {
			return [];
		}

		if (!reward.progress) {
			return [t('Locked')];
		}

		return [
			t('Locked · {percent}%', { percent: Math.floor(reward.progress.overall * 100) }),
			...reward.progress.conditions.map(
				(condition) =>
					`${formatRewardCondition(condition, t)}: ${Math.min(condition.value, condition.threshold)} / ${condition.threshold}`
			)
		];
	});

	const content = $derived(
		[
			`<span class="${cn(tooltipPanel, 'max-w-64 font-normal')}">`,
			ribbonTipHtml(ribbon),
			`<span class="block font-semibold text-white">${escapeHtml(reward.title)}</span>`,
			reward.description
				? `<span class="text-secondary-300 mt-0.5 block">${escapeHtml(reward.description)}</span>`
				: '',
			statusLines.length > 0
				? `<span class="text-secondary-500 mt-1.5 block text-xs">${statusLines.map(escapeHtml).join('<br>')}</span>`
				: '',
			'</span>'
		].join('')
	);
	const label = $derived(
		statusLines.length > 0 ? `${reward.title} (${statusLines[0]})` : reward.title
	);
</script>

<!-- Focusable so keyboard users get the tooltip (tippy also opens on focus). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	{@attach tooltip(content, { content, delay: [100, null] })}
	class={cn(
		'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
		ribbon
			? // Dark seam and a light top edge over the stripes, so it reads as cloth.
				"h-5 w-[70px] rounded-[2px] shadow-[0_1px_2px_rgb(0_0_0/0.6)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.18)] after:content-['']"
			: 'bg-secondary-900 size-8 rounded-sm',
		locked && 'shadow-none',
		className
	)}
	aria-label={label}
	role="img"
	tabindex="0"
>
	{#if ribbon}
		<img
			src={ribbon.url}
			alt=""
			width="70"
			height="20"
			loading="lazy"
			class={cn('size-full', locked && lockedImage)}
		/>
	{:else if reward.imageUrl}
		<img
			src={reward.imageUrl}
			alt=""
			width="150"
			height="150"
			loading="lazy"
			class={cn('size-full object-cover', locked && lockedImage)}
		/>
	{:else}
		<TrophyIcon size={20} class={cn('text-secondary-300', locked && 'opacity-40')} />
	{/if}
	{#if locked}
		<LockIcon
			size={ribbon ? 10 : 14}
			weight="fill"
			class="absolute text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.8)]"
		/>
	{/if}
</span>
