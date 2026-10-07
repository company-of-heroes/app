<script lang="ts">
	import type { DocModifier } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { effectLabel, effectValue } from './format';

	type Props = {
		effects: DocModifier[];
		class?: string;
	};

	let { effects, class: className }: Props = $props();
	const { t } = useI18n();

	// Several actions can carry the same modifier; show each effect once.
	const unique = $derived(
		effects.filter(
			(effect, index) =>
				effects.findIndex(
					(other) =>
						other.type === effect.type &&
						other.value === effect.value &&
						other.target === effect.target
				) === index
		)
	);
	const toneClass = { up: 'text-green-300', down: 'text-red-300', flag: 'text-secondary-200' };
</script>

<ul class={cn('flex flex-wrap gap-1.5', className)}>
	{#each unique as effect (`${effect.type}:${effect.target ?? ''}:${effect.value}`)}
		{@const label = effectLabel(effect.type)}
		{@const value = effectValue(effect)}
		<li class="border-secondary-800 bg-secondary-900/40 rounded-sm border px-2 py-0.5 text-xs">
			<span class="text-secondary-300">{label.known ? t(label.key) : label.key}</span>
			<span class={cn('ml-1 font-semibold tabular-nums', toneClass[value.tone])}>
				{value.tone === 'flag' ? t(value.text === 'on' ? 'On' : 'Off') : value.text}
			</span>
		</li>
	{/each}
</ul>
