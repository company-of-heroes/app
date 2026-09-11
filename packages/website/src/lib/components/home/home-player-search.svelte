<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import CardForm from '$lib/components/player/card-form.svelte';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<section>
	<CardForm class="py-2">
		{#snippet hint()}
			<Button href={href('/players')} variant="link" size="sm" class="ms-auto h-auto px-0 py-0">
				{t('View all')}
			</Button>
		{/snippet}
	</CardForm>
</section>
