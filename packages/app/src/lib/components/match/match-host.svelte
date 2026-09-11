<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { t } = useI18n();
	const match = useMatch();
	const label = $derived(match.hostName?.trim() || t('Unknown'));
</script>

<span {...restProps} class={cn('truncate', restProps.class)}>{label}</span>
