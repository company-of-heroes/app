<script lang="ts">
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import HandleIcon from 'phosphor-svelte/lib/DotsSixVerticalIcon';
	import { cn } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { tooltip } from '$lib/attachments';
	import { shortcuts, type BindingScope, type Shortcut } from '$core/app/features/shortcuts';
	import { Button } from '$lib/components/ui/button';
	import KeybindingChord from './keybinding-chord.svelte';
	import { useI18n } from '$lib/i18n';

	type Props = {
		keybinding: Shortcut;
		scope: BindingScope;
		class?: string;
	};

	let { keybinding, scope, class: className }: Props = $props();
	const { t } = useI18n();
</script>

<tr
	class={cn(
		'item group border-secondary-800 hover:bg-secondary-950/50 border-b transition-colors',
		'[&.sortable-ghost]:bg-primary/5 [&.sortable-chosen]:cursor-grabbing',
		className
	)}
>
	<td class="w-10 px-2 py-2">
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="handle text-secondary-600 hover:text-secondary-300 cursor-grab opacity-40 group-hover:opacity-100"
			aria-label={t('Reorder keybinding')}
		>
			<HandleIcon size={18} weight="bold" />
		</Button>
	</td>

	<td class="px-4 py-2">
		<input
			bind:value={keybinding.description}
			placeholder={t('Description')}
			class="border-secondary-800 bg-secondary-950/50 focus:border-secondary-600 placeholder:text-secondary-600 h-9 w-full rounded-sm border px-3 text-sm font-medium text-white focus:outline-none"
		/>
	</td>

	<td class="px-4 py-2">
		<KeybindingChord {keybinding} type="trigger" />
	</td>

	<td class="w-10 px-2 py-2 text-center">
		<ArrowRightIcon class="text-secondary-600 mx-auto size-4" aria-hidden="true" />
	</td>

	<td class="px-4 py-2">
		<KeybindingChord {keybinding} type="action" />
	</td>

	<td class="w-10 px-2 py-2">
		<Button
			variant="ghost"
			size="icon-sm"
			class={cn(
				interactive,
				'hover:text-destructive text-secondary-600 opacity-0 group-hover:opacity-100'
			)}
			onclick={() => shortcuts.removeBinding(scope, keybinding.id)}
			{@attach tooltip(t('Delete keybinding'))}
		>
			<TrashIcon size={18} />
		</Button>
	</td>
</tr>
