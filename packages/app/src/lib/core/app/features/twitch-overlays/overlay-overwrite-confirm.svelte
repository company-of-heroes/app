<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';

	type Props = {
		version?: string | null;
		onConfirm: () => void;
		onCancel: () => void;
	};

	let { version = null, onConfirm, onCancel }: Props = $props();
	const { t } = useI18n();
</script>

<div class="space-y-4 p-4">
	<div class="text-secondary-300 space-y-3 text-sm leading-relaxed">
		<p>
			{#if version}
				{t('The Opponent Bot (oppbot) overlay has a new version ({version}).', { version })}
			{:else}
				{t('The Opponent Bot (oppbot) overlay has a new version.')}
			{/if}
		</p>
		<p>
			{t(
				'Choose Update to install the latest default overlay. Your current overlay folder is backed up first, so any custom edits stay recoverable.'
			)}
		</p>
		<p>
			{t(
				'If you customized the overlay and want to keep those files as-is for now, choose Not now. You will be asked again the next time a newer oppbot version ships.'
			)}
		</p>
	</div>

	<div class="flex justify-end gap-2">
		<Button type="button" variant="secondary" onclick={onCancel}>{t('Not now')}</Button>
		<Button type="button" onclick={onConfirm}>{t('Update')}</Button>
	</div>
</div>
