<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { resource } from 'runed';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import * as List from '../ui/list';
	import { StaffDebug } from '../ui/staff-debug';
	import { detailMetaGrid } from '../variants';

	type Props = {
		steamId: string;
	};

	let { steamId }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const isStaff = $derived(host.auth.user?.isStaff ?? false);
	const companion = resource(
		() => (isStaff ? steamId : null),
		(id) => (id ? host.api.staff.getCompanionUser(id) : Promise.resolve(null))
	);

	const date = (value?: string | null) => formatDate(value, host.locale(), 'dateTime');

	const roleLabel = $derived.by(() => {
		const role = companion.current?.role;
		if (role === 'admin') {
			return t('Admin');
		}

		if (role === 'moderator') {
			return t('Moderator');
		}

		return '—';
	});
</script>

{#if isStaff}
	<StaffDebug>
		{#if companion.loading}
			<p class="text-secondary-400 text-sm">{t('Loading...')}</p>
		{:else if companion.error}
			<p class="text-sm text-red-400">{t('Could not load companion account.')}</p>
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
				<List.Value>{companion.current.appVersion ?? '—'}</List.Value>
				<List.Title>{t('Last login')}</List.Title>
				<List.Value>{date(companion.current.lastLogin)}</List.Value>
				<List.Title>{t('Created')}</List.Title>
				<List.Value>{date(companion.current.created)}</List.Value>
				<List.Title>{t('Updated')}</List.Title>
				<List.Value>{date(companion.current.updated)}</List.Value>
			</div>
		{/if}
	</StaffDebug>
{/if}
