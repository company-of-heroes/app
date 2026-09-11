<script lang="ts">
	import { page } from '$app/state';
	import { resource } from 'runed';
	import * as List from '@company-of-heroes/ui/list';
	import { detailMetaGrid } from '@company-of-heroes/ui/variants';
	import { isStaffUser } from '$lib/auth/user';
	import StaffDebug from '$lib/components/staff/staff-debug.svelte';
	import { currentLocale, useI18n } from '$lib/i18n';
	import { getCompanionUser } from '$lib/remote/companion-user.remote';

	type Props = {
		steamId: string;
	};

	let { steamId }: Props = $props();
	const { t } = useI18n();
	const isStaff = $derived(isStaffUser(page.data.user));
	const companion = resource(
		() => (isStaff ? steamId : null),
		(id) => (id ? getCompanionUser(id) : Promise.resolve(null))
	);

	const formatDate = (value?: string | null) => {
		if (!value) {
			return '—';
		}

		const date = new Date(value);
		if (!Number.isFinite(date.getTime())) {
			return '—';
		}

		return new Intl.DateTimeFormat(currentLocale(), {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	};

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
				<List.Value>{companion.current.appVersion ?? '—'}</List.Value>
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
