<script lang="ts">
	import {
		createPlayerPreview,
		type PlayerPreviewData
	} from '@company-of-heroes/ui/player';
	import { flagImageUrl, resolveAvatarUrl } from '$lib/utils/resolvers';
	import { useI18n } from '$lib/i18n';
	import { getPlayerPreview } from '$lib/remote/player-preview.remote';
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
	};

	let { children }: Props = $props();
	const { t } = useI18n();

	async function load(id: string): Promise<PlayerPreviewData | null> {
		return getPlayerPreview(id);
	}

	createPlayerPreview(() => ({
		load,
		resolveAvatarUrl,
		flagImageUrl,
		levelLabel: t('Level'),
		loadingLabel: t('Loading…'),
		errorLabel: t('Could not load player')
	}));
</script>

{#if children}
	{@render children()}
{/if}
