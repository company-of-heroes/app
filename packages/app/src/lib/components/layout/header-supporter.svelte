<script lang="ts">
	import { SupporterDialog } from '@company-of-heroes/ui/supporter';
	import type { SupporterStatus } from '@company-of-heroes/ui/supporter/types';
	import { isSupporter } from '@company-of-heroes/ui/format/labels';
	import { useHost } from '@company-of-heroes/ui/host';
	import { tooltip } from '$lib/attachments';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { watch } from 'runed';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import { app } from '$core/app/context';
	import { api, unwrapApi } from '$core/api';
	import { refreshPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const host = useHost();

	let open = $state(false);
	let status = $state.raw<SupporterStatus | null>(null);

	// The main Steam ID carries the account rewards; its labels are already cached app-wide.
	const steamId = $derived(app.features.auth.user.steamIds?.[0] ?? null);
	// The fetched status is the truth; the label can lag behind a lapsed subscription.
	const active = $derived(
		status ? status.active : steamId ? isSupporter(host.api.labels.forSteamId(steamId)) : false
	);
	const label = $derived(active ? t('Supporter') : t('Become a supporter'));

	// The end date is only needed in the dialog: ask when it opens, never per page view.
	watch(
		() => open,
		(isOpen) => {
			if (!isOpen) {
				return;
			}

			void api.subscriptions.me().then((result) => {
				status = result.isOk() ? result.value : null;
				// Labels are cached for the session: a subscription that started or ended since
				// then would keep the medal wrong next to this account's names.
				if (
					status &&
					steamId &&
					status.active !== isSupporter(host.api.labels.forSteamId(steamId))
				) {
					refreshPlayerLabels(app.features.auth.user.steamIds ?? []);
				}
			});
		}
	);

	async function manage() {
		const { url } = await unwrapApi(api.subscriptions.portal());
		await openUrl(url);
	}
</script>

<Button
	size="sm"
	variant="primary"
	aria-label={label}
	{@attach tooltip(label)}
	onclick={() => (open = true)}
>
	<HeartIcon size={14} weight="fill" />
	{label}
</Button>

<SupporterDialog
	bind:open
	{active}
	endsAt={status?.endsAt ?? null}
	onsupporters={() => host.openSupporters?.()}
	onsubscribe={() => host.openSupporters?.({ checkout: true })}
	onmanage={manage}
/>
