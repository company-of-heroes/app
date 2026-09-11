<script lang="ts">
	import { page } from '$app/state';
	import * as Dropdown from '@company-of-heroes/ui/dropdown';
	import { dropdownItemIcon } from '@company-of-heroes/ui/variants';
	import { cn } from '$lib/utils/cn';
	import { headerCellAction, interactive } from '$lib/utils/variants';
	import {
		currentLocale,
		localeLabels,
		locales,
		localeSwitchHref,
		useI18n,
		type AppLocale
	} from '$lib/i18n';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import TranslateIcon from 'phosphor-svelte/lib/Translate';

	type Props = {
		class?: string;
		side?: 'top' | 'bottom';
		align?: 'start' | 'center' | 'end';
	};

	let { class: className, side = 'bottom', align = 'end' }: Props = $props();
	const { t } = useI18n();
	const locale = $derived(currentLocale());

	function switchHref(next: AppLocale) {
		return localeSwitchHref(`${page.url.pathname}${page.url.search}${page.url.hash}`, next);
	}

	function select(next: AppLocale) {
		if (next === locale) {
			return;
		}

		window.location.assign(switchHref(next));
	}
</script>

<div class="flex h-full items-stretch">
	<Dropdown.Root
		{side}
		{align}
		alignOffset={-1}
		sideOffset={0}
		class="w-44"
		forceMount
		preventScroll={false}
		trapFocus={false}
	>
		{#snippet trigger({ props })}
			<button
				type="button"
				aria-label={t('Language')}
				{...props}
				class={cn(
					interactive,
					headerCellAction,
					'inline-flex h-full items-center gap-1.5 px-4',
					className,
					props.class
				)}
			>
				<TranslateIcon size={18} weight="duotone" class="text-primary shrink-0" />
				<span class="text-sm font-medium text-white">{localeLabels[locale]}</span>
				<CaretDownIcon size={14} weight="bold" class="text-secondary-400 shrink-0" />
			</button>
		{/snippet}
		{#each locales as item (item)}
			<Dropdown.Item class={dropdownItemIcon} onSelect={() => select(item)}>
				<CheckIcon
					size={18}
					weight="bold"
					class={cn('shrink-0', item === locale ? 'text-primary' : 'opacity-0')}
				/>
				{localeLabels[item]}
			</Dropdown.Item>
		{/each}
	</Dropdown.Root>
</div>
