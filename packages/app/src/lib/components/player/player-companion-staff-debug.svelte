<script lang="ts">
	import dayjs from '$lib/dayjs';
	import { resource } from 'runed';
	import * as List from '$lib/components/ui/list';
	import { StaffDebug } from '$lib/components/staff';
	import { account } from '$core/account';
	import { findCompanionUserBySteamId, readMetaVersion } from '$core/pocketbase/companion-user';
	import { UsersRoleOptions } from '$core/pocketbase/types';
	import { detailMetaGrid } from '$lib/components/ui/variants';
	import { useI18n } from '$lib/i18n';

	type Props = {
		steamId: string;
	};

	let { steamId }: Props = $props();
	const { t } = useI18n();
	const companion = resource(
		() => (account.isStaff ? steamId : null),
		async (id) => {
			if (!id) {
				return null;
			}

			return findCompanionUserBySteamId(id);
		}
	);

	const formatDate = (value?: string | null) =>
		value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '—';

	const roleLabel = $derived.by(() => {
		const role = companion.current?.role;
		if (role === UsersRoleOptions.admin) {
			return t('Admin');
		}

		if (role === UsersRoleOptions.moderator) {
			return t('Moderator');
		}

		return '—';
	});
</script>

{#if account.isStaff}
	<StaffDebug>
		{#if companion.loading}
			<p class="text-secondary-400 text-sm">{t('Loading...')}</p>
		{:else if companion.error}
			<p class="text-red-400 text-sm">{t('Could not load companion account.')}</p>
		{:else if !companion.current}
			<p class="text-secondary-300 text-sm">{t('This player has no coh1stats account.')}</p>
		{:else}
			<div class={detailMetaGrid}>
				<List.Title>{t('User ID')}</List.Title>
				<List.Value class="tabular-nums">{companion.current.id}</List.Value>
				<List.Title>{t('Email')}</List.Title>
				<List.Value>{companion.current.email || '—'}</List.Value>
				<List.Title>{t('Role')}</List.Title>
				<List.Value>{roleLabel}</List.Value>
				<List.Title>{t('App version')}</List.Title>
				<List.Value>{readMetaVersion(companion.current.meta) ?? '—'}</List.Value>
				<List.Title>{t('Last login')}</List.Title>
				<List.Value>{formatDate(companion.current.lastLogin)}</List.Value>
				<List.Title>{t('Created')}</List.Title>
				<List.Value>{formatDate(companion.current.created)}</List.Value>
				<List.Title>{t('Updated')}</List.Title>
				<List.Value>{formatDate(companion.current.updated)}</List.Value>
			</div>
		{/if}
	</StaffDebug>
{/if}
