<script lang="ts">
	import { app } from '$core/app/context';
	import { Alert } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';

	type Props = { message: string; class?: string };

	let { message, class: className }: Props = $props();
	const { t } = useI18n();
</script>

{#if !app.cohPaths.warningsLog}
	<Alert variant="warning" size="sm" class={className}>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p>{message}</p>
			<Button href="/settings" size="sm" variant="secondary">{t('Open settings')}</Button>
		</div>
	</Alert>
{/if}
