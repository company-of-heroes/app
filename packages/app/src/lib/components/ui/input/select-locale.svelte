<script lang="ts">
	import { Select } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { controlBase, menuItem } from '../variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import { detectOsLocale, isAppLocale, localeLabels, locales, setLocale } from '$lib/i18n';
	import { watch } from 'runed';

	let { value = $bindable('en') }: { value: string } = $props();

	const items = locales.map((locale) => ({
		value: locale,
		label: localeLabels[locale]
	}));
	const selectedLabel = $derived(isAppLocale(value) ? localeLabels[value] : value);

	if (!isAppLocale(value)) {
		value = detectOsLocale();
	}

	watch(
		() => value,
		(locale) => setLocale(locale)
	);
</script>

<Select.Root type="single" bind:value {items}>
	<Select.Trigger
		class={cn(
			controlBase,
			'group flex w-64 cursor-pointer items-center justify-between truncate px-4 text-left'
		)}
	>
		{selectedLabel}
		<CaretDownIcon class="ms-4 shrink-0 group-data-[state=open]:rotate-180" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			align="start"
			side="bottom"
			sideOffset={6}
			class="overlay-surface border-secondary-800 z-50 max-h-72 w-(--bits-select-anchor-width) min-w-(--bits-select-anchor-width) rounded-md border shadow-md"
		>
			<Select.ScrollUpButton class="flex items-center justify-center py-1">
				<CaretUpIcon />
			</Select.ScrollUpButton>
			<Select.Viewport>
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class={cn(menuItem, 'flex w-full items-center gap-4')}
					>
						{#snippet children({ selected }: any)}
							{item.label}
							{#if selected}
								<CheckIcon class="ms-auto" weight="bold" />
							{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
			<Select.ScrollDownButton class="flex items-center justify-center py-1">
				<CaretDownIcon />
			</Select.ScrollDownButton>
		</Select.Content>
	</Select.Portal>
</Select.Root>
