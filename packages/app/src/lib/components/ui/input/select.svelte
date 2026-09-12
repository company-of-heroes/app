<script lang="ts">
	import { Select as UiSelect, type SelectProps } from '@company-of-heroes/ui/input';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	let {
		value = $bindable(),
		empty = t('No results found.'),
		selectedCountLabel = (count: number) => t('{count} items', { count }),
		...restProps
	}: SelectProps = $props();
</script>

<UiSelect bind:value={value as never} {empty} {selectedCountLabel} {...restProps} />
