<script lang="ts">
	import CaptureImage from '$lib/components/anti-cheat/capture-image.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { CaptureRecord } from '$core/pocketbase/anti-cheat';
	import { cn, normalizeMapName } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import dayjs from '$lib/dayjs';
	import { useI18n } from '$lib/i18n';

	type Props = {
		capture: CaptureRecord;
		onConfirm: () => void | Promise<void>;
		onCancel: () => void;
	};

	let { capture, onConfirm, onCancel }: Props = $props();
	const { t } = useI18n();
	let hiding = $state(false);

	const owner = $derived(capture.expand?.user?.name || capture.expand?.user?.email || '');

	const meta = $derived.by(() => {
		const parts: string[] = [];
		if (capture.map) {
			parts.push(normalizeMapName(capture.map));
		}

		if (capture.session_id) {
			parts.push(`${t('Session')} ${capture.session_id}`);
		}

		return parts.join(' · ');
	});

	const capturedAt = $derived(
		dayjs(capture.captured_at || capture.created).format('D MMM YYYY HH:mm')
	);

	async function confirm() {
		if (hiding) {
			return;
		}

		hiding = true;
		try {
			await onConfirm();
		} finally {
			hiding = false;
		}
	}
</script>

<div class="flex flex-col gap-4 p-4">
	<div class="border-secondary-800 relative aspect-video overflow-clip rounded-md border">
		<CaptureImage {capture} class="absolute inset-0 size-full object-cover" />
	</div>

	<div class="min-w-0">
		{#if owner || capture.steam_id}
			{#if capture.steam_id}
				<a
					href="/players/{capture.steam_id}"
					class={cn(
						interactive,
						'text-secondary-100 hover:text-primary block truncate text-sm font-medium'
					)}
				>
					{owner || capture.steam_id}
				</a>
			{:else}
				<p class="text-secondary-100 truncate text-sm font-medium">{owner}</p>
			{/if}
			{#if owner && capture.steam_id}
				<p class="text-secondary-400 mt-0.5 truncate text-sm tabular-nums">{capture.steam_id}</p>
			{/if}
		{/if}
		{#if meta}
			<p class="text-secondary-400 mt-0.5 truncate text-sm">{meta}</p>
		{/if}
		<p class="text-secondary-500 mt-0.5 text-sm tabular-nums">{capturedAt}</p>
	</div>

	<p class="text-secondary-400 text-sm">
		{t('This screenshot will be hidden from players.')}
	</p>

	<div class="flex justify-end gap-2">
		<Button type="button" variant="secondary" disabled={hiding} onclick={onCancel}>
			{t('Cancel')}
		</Button>
		<Button type="button" variant="secondary" loading={hiding} onclick={() => void confirm()}>
			{t('Hide')}
		</Button>
	</div>
</div>
