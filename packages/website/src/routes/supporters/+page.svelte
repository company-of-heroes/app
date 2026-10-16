<script lang="ts">
	import { SupportersPage } from '@company-of-heroes/ui/supporter';
	import { goto, replaceState } from '$app/navigation';
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

	const signedIn = $derived(data.signedIn);

	async function subscribe() {
		if (!signedIn) {
			await goto(loginRedirectHref(href('/supporters?checkout=1'), currentLocale()));
			return;
		}

		let checkout;
		try {
			checkout = await startSupporterCheckout();
		} finally {
			// Back from the login: drop the flag so a reload does not reopen the checkout. Only
			// after an await: on arrival this runs from onMount, before the router is ready.
			if (page.url.searchParams.has('checkout')) {
				const url = new URL(page.url);
				url.searchParams.delete('checkout');
				replaceState(url, page.state);
			}
		}

		await openCheckout(checkout, `${page.url.origin}${href('/supporters')}?welcome=1`);
	}

	async function manage() {
		const { url } = await openSupporterPortal();
		window.location.assign(url);
	}
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
	autoSubscribe={data.checkout}
	onsubscribe={subscribe}
	onmanage={manage}
	loadStatus={() => getSupporterStatus()}
/>
