<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';

	type Props = {
		count: number;
		onConfirm: () => void | Promise<void>;
		onCancel: () => void;
	};

	let { count, onConfirm, onCancel }: Props = $props();
	const { t } = useI18n();
	let deleting = $state(false);

	async function confirm() {
		if (deleting) {
			return;
		}

		deleting = true;
		try {
			await onConfirm();
		} finally {
			deleting = false;
		}
	}
</script>

<div class="flex flex-col gap-4 p-4">
	<p class="text-secondary-400 text-sm">
		{t('{count} screenshots will be permanently deleted.', { count })}
	</p>

	<div class="flex justify-end gap-2">
		<Button type="button" variant="secondary" disabled={deleting} onclick={onCancel}>
			{t('Cancel')}
		</Button>
		<Button type="button" variant="destructive" loading={deleting} onclick={() => void confirm()}>
			{t('Delete')}
		</Button>
	</div>
</div>
