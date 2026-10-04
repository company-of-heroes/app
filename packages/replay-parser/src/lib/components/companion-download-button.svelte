<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { tooltip } from '@company-of-heroes/ui/tooltip';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import { useI18n } from '$lib/i18n';
	import { downloadCompanionApp } from '$lib/companion-download';

	const { t } = useI18n();

	let downloading = $state(false);

	async function download() {
		downloading = true;
		try {
			await downloadCompanionApp();
		} finally {
			downloading = false;
		}
	}
</script>

<Button
	variant="secondary"
	size="sm"
	class="h-7 px-2.5"
	loading={downloading}
	onclick={() => void download()}
	{@attach tooltip(t('Free Windows app for lobby scouting, match history and stream overlays.'), {
		placement: 'bottom'
	})}
>
	<DownloadSimpleIcon size={16} weight="duotone" />
	{t('Download companion')}
</Button>
