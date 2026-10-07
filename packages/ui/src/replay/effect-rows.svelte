<script lang="ts">
	import type { DocModifier } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { effectLabel, effectValue, uniqueEffects } from '../docs/format';

	type Props = {
		effects: DocModifier[];
		/** Each value right after its label (full pages) instead of pushed to the far edge (popovers). */
		inline?: boolean;
		class?: string;
	};

	let { effects, inline = false, class: className }: Props = $props();
	const { t } = useI18n();

	const toneClass = { good: 'text-green-300', bad: 'text-red-300', flag: 'text-secondary-200' };

	// Effects on several targets (each weapon, each model) often read the same; show each line once.
	const rows = $derived.by(() => {
		const seen = new Set<string>();
		return uniqueEffects(effects)
			.map((effect) => {
				const name = effectLabel(effect.type);
				const value = effectValue(effect);
				const label = name.known ? t(name.key) : name.key;
				const text = value.tone === 'flag' ? t(value.text === 'on' ? 'On' : 'Off') : value.text;
				return { key: `${label}:${text}`, label, text, tone: value.tone };
			})
			.filter((row) => !seen.has(row.key) && seen.add(row.key));
	});
</script>

<dl class={cn('text-xs', inline ? 'space-y-0' : 'space-y-0.5', className)}>
	{#each rows as row (row.key)}
		<div class={cn('flex items-baseline gap-2', !inline && 'justify-between')}>
			<dt class="text-secondary-300 min-w-0 truncate">{row.label}</dt>
			<dd class={cn('shrink-0 font-semibold tabular-nums', toneClass[row.tone])}>
				{row.text}
			</dd>
		</div>
	{/each}
</dl>
