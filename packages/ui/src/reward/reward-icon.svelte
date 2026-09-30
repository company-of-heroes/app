<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { cn } from '../cn';
	import { formatDate } from '../format/date';
	import { tryUseHost } from '../host/host.context';
	import { formatRewardCondition } from './metrics';
	import type { RewardView } from './types';

	type Props = {
		reward: RewardView;
		class?: string;
	};

	let { reward, class: className }: Props = $props();
	const { t } = useI18n();
	const host = tryUseHost();

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

		const conditions = reward.progress?.conditions ?? [];
		if (conditions.length === 0) {
			return '';
		}

		return conditions
			.map(
				(condition) =>
					`${formatRewardCondition(condition, t)}: ${Math.min(condition.value, condition.threshold)} / ${condition.threshold}`
			)
			.join('<br>');
	}

	const content = $derived(
		[
			'<span class="bg-secondary-950 border-secondary-800 block max-w-64 rounded border px-3 py-2 text-left text-sm">',
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
		'bg-secondary-900 inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm',
		className
	)}
	aria-label={reward.title}
	role="img"
>
	{#if reward.imageUrl}
		<img
			src={reward.imageUrl}
			alt=""
			width="150"
			height="150"
			loading="lazy"
			class="size-full object-cover"
		/>
	{:else}
		<TrophyIcon size={20} class="text-secondary-300" />
	{/if}
</span>
