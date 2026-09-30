<script lang="ts">
	import type { TransformedMatch } from '@company-of-heroes/ui/player';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import { app } from '$core/app/context';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import type { MatchHistoryView } from '$lib/player/match-history-view.svelte';

	type Props = {
		view: MatchHistoryView;
		match: TransformedMatch;
	};

	let { view, match }: Props = $props();
	const { t } = useI18n();

	const manuallyHidden = $derived(view.isManuallyHidden(match.id));

	async function toggle() {
		const confirmed = await confirm(
			manuallyHidden
				? t('Show this match on public overviews again?')
				: t('Hide this match from public overviews?'),
			{
				okLabel: manuallyHidden ? t('Show') : t('Hide'),
				cancelLabel: t('Cancel'),
				kind: 'warning'
			}
		);
		if (!confirmed) {
			return;
		}

		const hide = !manuallyHidden;
		try {
			await view.setHidden(match.id, hide);
			app.toast.success(
				hide ? t('Match hidden from public overviews.') : t('Match is visible again.')
			);
		} catch (error) {
			console.error('[MATCH-HISTORY]: hide toggle failed:', error);
			app.toast.error(hide ? t('Could not hide this match.') : t('Could not show this match.'));
		}
	}
</script>

{#if view.isStaff}
	{#if view.isHidden(match.id, match.description)}
		<Badge variant="warning">{t('Hidden')}</Badge>
	{/if}
	<Button
		type="button"
		size="sm"
		variant="secondary"
		loading={view.pendingSessionId === match.id}
		onclick={toggle}
	>
		{#if manuallyHidden}
			<EyeIcon class="size-4" />
			{t('Show match')}
		{:else}
			<EyeSlashIcon class="size-4" />
			{t('Hide match')}
		{/if}
	</Button>
{/if}
