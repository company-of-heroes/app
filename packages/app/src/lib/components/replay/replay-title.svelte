<script lang="ts">
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useReplay } from '.';
	import { useI18n } from '$lib/i18n';

	type Props = {
		crumbLabel?: string | null;
	};

	let { crumbLabel = null }: Props = $props();
	const { t } = useI18n();
	let replay = $derived(useReplay());
</script>

<SetCrumbs items={[{ label: crumbLabel || replay.replayName || t('Replay') }]} />
