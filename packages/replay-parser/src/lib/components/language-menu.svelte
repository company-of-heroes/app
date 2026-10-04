<script lang="ts">
	import * as Dropdown from '@company-of-heroes/ui/dropdown';
	import { Button } from '@company-of-heroes/ui/button';
	import { cn } from '@company-of-heroes/ui/cn';
	import { dropdownItemIcon } from '@company-of-heroes/ui/variants';
	import { localeLabels, locales, type AppLocale } from '@company-of-heroes/i18n';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import TranslateIcon from 'phosphor-svelte/lib/Translate';
	import { setLocale, useI18n } from '$lib/i18n';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const i18n = useI18n();
	const locale = $derived(i18n.getLocale() as AppLocale);
</script>

<Dropdown.Root side="bottom" align="end" sideOffset={6} class="w-44">
	{#snippet trigger({ props })}
		<Button
			{...props}
			variant="ghost"
			size="sm"
			class={cn('h-7 px-2.5', className, props.class)}
			aria-label={i18n.t('Language')}
		>
			<TranslateIcon size={16} weight="duotone" />
			{localeLabels[locale]}
		</Button>
	{/snippet}
	{#each locales as item (item)}
		<Dropdown.Item class={dropdownItemIcon} onSelect={() => void setLocale(item)}>
			<CheckIcon
				size={18}
				weight="bold"
				class={cn('shrink-0', item === locale ? 'text-primary' : 'opacity-0')}
			/>
			{localeLabels[item]}
		</Dropdown.Item>
	{/each}
</Dropdown.Root>
