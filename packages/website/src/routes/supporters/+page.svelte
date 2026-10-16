<script lang="ts">
	import { SupportersPage } from '@company-of-heroes/ui/supporter';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Seo from '$lib/components/seo/seo.svelte';
	import { currentLocale, href, useI18n } from '$lib/i18n';
	import { loginRedirectHref } from '$lib/auth/user';
	import { openCheckout } from '$lib/paddle';
	import {
		getSupporterStatus,
		openSupporterPortal,
		startSupporterCheckout
	} from '$lib/remote/subscriptions.remote';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const signedIn = $derived(!!data.status);

	async function subscribe() {
		if (!signedIn) {
			await goto(loginRedirectHref(href('/supporters?checkout=1'), currentLocale()));
			return;
		}

		const checkout = await startSupporterCheckout();
		await openCheckout(checkout, `${page.url.origin}${href('/supporters')}?welcome=1`);
	}

	async function manage() {
		const { url } = await openSupporterPortal();
		window.location.assign(url);
	}

	// Back from the login with `?checkout=1`: open the checkout straight away.
	onMount(() => {
		if (data.checkout && data.status && !data.status.active) {
			void subscribe().catch((error) => console.error('[supporters] checkout failed', error));
		}
	});
</script>

<Seo
	title={t('Supporters')}
	description={t(
		'Support coh1stats for €5 a month: a medal, ribbons and a player card. See the current supporters and the hall of fame.'
	)}
/>

<SupportersPage
	list={data.list}
	status={data.status}
	welcome={data.welcome}
	onsubscribe={subscribe}
	onmanage={manage}
	loadStatus={() => getSupporterStatus()}
/>
