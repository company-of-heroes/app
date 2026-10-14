<script lang="ts">
	import { DocsWeaponList } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title="{t('Weapons')} | {t('Wiki')}"
	ogTitle={t('CoH weapons')}
	description={t('Damage, accuracy, range and penetration of every Company of Heroes weapon.')}
/>

<DocsWeaponList weapons={data.weapons} />
