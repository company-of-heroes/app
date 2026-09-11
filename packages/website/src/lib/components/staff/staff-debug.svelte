<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { StaffDebug as Panel } from '@company-of-heroes/ui/staff-debug';
	import { useI18n } from '$lib/i18n';

	type Props = {
		children: Snippet;
	} & HTMLAttributes<HTMLElement>;

	let { children, ...restProps }: Props = $props();
	const { t } = useI18n();
</script>

<Panel staffOnlyLabel={t('Staff only')} {...restProps}>
	{@render children()}
</Panel>
