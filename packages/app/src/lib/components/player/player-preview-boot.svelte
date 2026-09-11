<script lang="ts">
	import {
		createPlayerPreview,
		toPlayerPreviewData,
		type PlayerPreviewData
	} from '@company-of-heroes/ui/player';
	import { api } from '$core/api';
	import { flagImageUrl } from '$lib/utils/leaderboard-resolvers';
	import { useI18n } from '$lib/i18n';
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
	};

	let { children }: Props = $props();
	const { t } = useI18n();

	async function load(id: string): Promise<PlayerPreviewData | null> {
		const result = await api.players.get(id);
		if (result.isErr()) {
			return null;
		}

		return toPlayerPreviewData(result.value);
	}

	createPlayerPreview(() => ({
		load,
		resolveAvatarUrl: (url) => url,
		flagImageUrl,
		levelLabel: t('Level'),
		loadingLabel: t('Loading…'),
		errorLabel: t('Could not load player')
	}));
</script>

{#if children}
	{@render children()}
{/if}
