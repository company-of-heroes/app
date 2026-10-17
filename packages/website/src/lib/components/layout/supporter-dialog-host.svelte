<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SupporterDialog, type SupporterStatus } from '@company-of-heroes/ui/supporter';
	import { watch } from 'runed';
	import { loginRedirectHref } from '$lib/auth/user';
	import { currentLocale, href } from '$lib/i18n';
	import {
		cancelSupporter,
		getSupporterStatus,
		resumeSupporter,
		startSupporterCheckout
	} from '$lib/remote/subscriptions.remote';
	import { supporterDialog } from '$lib/supporter-dialog.svelte';
	import { useIsSupporter } from '$lib/supporter-status.svelte';

	const signedIn = $derived(!!page.data.user);
	const known = useIsSupporter();

	// The end date is only needed in the dialog: ask for it when the dialog opens, never per page view.
	watch(
		() => supporterDialog.open,
		(open) => {
			if (!open || !signedIn) {
				return;
			}

			getSupporterStatus()
				.then((status) => {
					supporterDialog.active = status.active;
					supporterDialog.endsAt = status.endsAt ?? null;
				})
				.catch(() => {
					// The dialog still works without the end date.
				});
		}
	);

	async function subscribe() {
		if (!signedIn) {
			const next = href('/supporters?checkout=1');
			supporterDialog.open = false;
			await goto(loginRedirectHref(next, currentLocale()));
			return;
		}

		const checkout = await startSupporterCheckout();
		window.location.assign(checkout.checkoutUrl);
	}

	function apply(status: SupporterStatus) {
		supporterDialog.active = status.active;
		supporterDialog.endsAt = status.endsAt ?? null;
	}
</script>

<SupporterDialog
	bind:open={supporterDialog.open}
	active={known.current}
	endsAt={supporterDialog.endsAt}
	supportersHref={href('/supporters')}
	onsubscribe={subscribe}
	oncancel={async () => apply(await cancelSupporter())}
	onresume={async () => apply(await resumeSupporter())}
/>
