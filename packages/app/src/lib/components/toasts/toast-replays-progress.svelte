<script lang="ts">
	import { app } from '$core/app/context';
	import SpinnerIcon from 'phosphor-svelte/lib/SpinnerIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const progress = $derived(app.features['replay-analyzer'].progress);
	const percent = $derived(
		progress.total > 0 ? Math.min(100, (progress.processed / progress.total) * 100) : 0
	);
</script>

<!-- Sonner already wraps custom toasts in `toastBase`; render content only -->
<span class="bg-secondary-700/60 inline-flex text-secondary-200 shrink-0 rounded-md p-1">
	<SpinnerIcon size={10} weight="bold" class="animate-spin" />
</span>
<div class="flex min-w-0 flex-1 flex-col gap-1.5">
	<div class="flex items-baseline justify-between gap-2">
		<span class="text-sm font-semibold">{t('Analyzing replays')}</span>
		<span class="text-secondary-400 text-xs tabular-nums">
			{progress.processed} / {progress.total}
		</span>
	</div>
	<div class="bg-secondary-800 h-1 overflow-hidden rounded-full">
		<div class="bg-primary h-full transition-[width] duration-300" style:width="{percent}%"></div>
	</div>
</div>
