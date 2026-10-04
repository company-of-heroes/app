<script lang="ts">
	import type { TransformedMatch } from '@company-of-heroes/ui/player';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import BracketsCurlyIcon from 'phosphor-svelte/lib/BracketsCurly';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import { cn } from '@company-of-heroes/ui/cn';
	import { app } from '$core/app/context';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import { relic } from '$lib/relic';
	import type { MatchHistoryView } from '$lib/player/match-history-view.svelte';

	type Props = {
		view: MatchHistoryView;
		match: TransformedMatch;
	};

	let { view, match }: Props = $props();
	const { t } = useI18n();

	const manuallyHidden = $derived(view.isManuallyHidden(match.id));

	let jsonCopied = $state(false);
	let jsonCopiedTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyJson() {
		const raw = relic.getRawMatchHistoryItem(match.id);
		if (!raw) {
			app.toast.error(t('No Relic data loaded for this match.'));
			return;
		}

		try {
			await navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
			app.toast.success(t('Relic JSON copied to clipboard.'));
			jsonCopied = true;
			clearTimeout(jsonCopiedTimer);
			jsonCopiedTimer = setTimeout(() => (jsonCopied = false), 2000);
		} catch (error) {
			console.error('[MATCH-HISTORY]: copy JSON failed:', error);
			app.toast.error(t('Could not copy the Relic JSON.'));
		}
	}

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
		disabled={jsonCopied}
		class={cn('transition-none', jsonCopied && 'hover:bg-transparent')}
		onclick={copyJson}
	>
		{#if jsonCopied}
			<ChecksIcon class="size-4 text-green-400" />
		{:else}
			<BracketsCurlyIcon class="size-4" />
		{/if}
		{t('Copy JSON')}
	</Button>
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
