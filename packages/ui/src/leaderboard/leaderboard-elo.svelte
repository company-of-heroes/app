<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import EloBadge from '../player/elo-badge.svelte';

	type Props = {
		/** Nothing renders without a stored ELO. */
		elo: number | null;
		class?: string;
	};

	const { t } = useI18n();

	let { elo, class: className }: Props = $props();
</script>

<EloBadge {elo} label={t('Companion ELO from recorded matches')} class={className} />
