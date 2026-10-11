<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import LockIcon from 'phosphor-svelte/lib/LockIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { cn } from '../cn';
	import { formatDate } from '../format/date';
	import { tryUseHost } from '../host/host.context';
	import { tooltipPanel } from '../variants';
	import { formatRewardCondition } from './metrics';
	import type { RewardView } from './types';

	type Props = {
		reward: RewardView;
		class?: string;
	};

	let { reward, class: className }: Props = $props();
	const { t } = useI18n();
	const host = tryUseHost();
	/** Not unlocked yet: only the owner sees these, faded with a lock. */
	const locked = $derived(!reward.unlockedAt);
	const lockedImage = 'opacity-35 grayscale';
	const ribbon = $derived(
		reward.ribbon
			? (host?.resolve.ribbons().find((item) => item.key === reward.ribbon) ?? null)
			: null
	);

	function escape(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;');
	}

	function status(): string {
		if (reward.unlockedAt) {
			return formatDate(reward.unlockedAt, host?.locale() ?? 'en');
		}

		const locked = t('Locked · {percent}%', {
			percent: Math.floor((reward.progress?.overall ?? 0) * 100)
		});
		const conditions = reward.progress?.conditions ?? [];
		return [
			locked,
			...conditions.map(
				(condition) =>
					`${formatRewardCondition(condition, t)}: ${Math.min(condition.value, condition.threshold)} / ${condition.threshold}`
			)
		].join('<br>');
	}

	const content = $derived(
		[
			`<span class="${cn(tooltipPanel, 'max-w-64 font-normal')}">`,
			`<span class="block font-semibold text-white">${escape(reward.title)}</span>`,
			reward.description
				? `<span class="text-secondary-300 mt-0.5 block">${escape(reward.description)}</span>`
				: '',
			status() ? `<span class="text-secondary-500 mt-1.5 block text-xs">${status()}</span>` : '',
			'</span>'
		].join('')
	);
</script>

<span
	{@attach tooltip(content, { content, delay: [100, null] })}
	class={cn(
		'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
		ribbon
			? 'h-4 w-14 rounded-[1px] shadow-sm shadow-black/50'
			: 'bg-secondary-900 size-8 rounded-sm',
		locked && 'shadow-none',
		className
	)}
	aria-label={locked ? `${reward.title} (${t('Locked')})` : reward.title}
	role="img"
>
	{#if ribbon}
		<img
			src={ribbon.url}
			alt=""
			width="56"
			height="16"
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
