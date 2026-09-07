<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';

	type Props = {
		onConfirm: () => void;
		onCancel: () => void;
	};

	let { onConfirm, onCancel }: Props = $props();
	const { t } = useI18n();
</script>

<div class="space-y-4 p-4">
	<div class="text-secondary-300 space-y-3 text-sm leading-relaxed">
		<p>
			{t(
				'At the start of each match, the app can post "[FAIRPLAY] Supervised by coh1stats.com" in all-chat so other players can see that fair play is watching you.'
			)}
		</p>
		<p>
			{t(
				'That builds trust in the community that you are a reliable player. Allow this by default? You can change it later in Settings.'
			)}
		</p>
	</div>

	<div class="flex justify-end gap-2">
		<Button type="button" variant="secondary" onclick={onCancel}>{t('Not now')}</Button>
		<Button type="button" onclick={onConfirm}>{t('Enable')}</Button>
	</div>
</div>
