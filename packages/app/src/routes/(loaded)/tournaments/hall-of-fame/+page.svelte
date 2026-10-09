<script lang="ts">
	import { TournamentHallOfFame } from '@company-of-heroes/ui/tournament';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<SetCrumbs items={[{ label: t('Hall of fame') }]} />

<TournamentHallOfFame />
