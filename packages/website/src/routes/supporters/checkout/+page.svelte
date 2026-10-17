<script lang="ts">
	import { SupporterCheckoutStatus } from '@company-of-heroes/ui/supporter';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { getCheckoutState, startSupporterCheckout } from '$lib/remote/subscriptions.remote';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	async function retry() {
		const { checkoutUrl } = await startSupporterCheckout();
		window.location.assign(checkoutUrl);
	}
</script>

<Seo title={t('Supporter')} noindex />

<SupporterCheckoutStatus
	state={data.state}
	loadState={() => getCheckoutState()}
	onretry={retry}
	supportersHref={href('/supporters')}
	accountHref={href('/account')}
/>
