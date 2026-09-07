<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import HardDrivesIcon from 'phosphor-svelte/lib/HardDrivesIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import { useI18n } from '$lib/i18n';

	export type ReplayDeleteMode = 'local' | 'everywhere';

	type Props = {
		title: string;
		hasLocal: boolean;
		onConfirm: (mode: ReplayDeleteMode) => void | Promise<void>;
		onCancel: () => void;
	};

	let { title, hasLocal, onConfirm, onCancel }: Props = $props();
	const { t } = useI18n();
	let deleting = $state<ReplayDeleteMode | null>(null);

	async function confirm(mode: ReplayDeleteMode) {
		if (deleting) return;
		deleting = mode;
		try {
			await onConfirm(mode);
		} finally {
			deleting = null;
		}
	}
</script>

<div class="flex flex-col gap-5 p-4">
	<p class="text-secondary-300 text-sm leading-relaxed">
		{t('Choose what to remove for')}
		<span class="text-secondary-100 font-medium">{title || t('this replay')}</span>.
	</p>

	<div class="flex flex-col gap-3">
		<button
			type="button"
			class={cn(
				'border-secondary-800 bg-secondary-950/40 hover:border-secondary-600 hover:bg-secondary-900/60',
				'flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-colors',
				'disabled:cursor-not-allowed disabled:opacity-50'
			)}
			disabled={!!deleting || !hasLocal}
			onclick={() => void confirm('local')}
		>
			<span
				class="bg-secondary-800 text-secondary-200 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md"
			>
				{#if deleting === 'local'}
					<span
						class="border-secondary-400 size-4 animate-spin rounded-full border-2 border-t-transparent"
					></span>
				{:else}
					<HardDrivesIcon size={18} />
				{/if}
			</span>
			<span class="min-w-0">
				<span class="text-secondary-100 block text-sm font-medium">{t('Local file only')}</span>
				<span class="text-secondary-400 mt-1 block text-sm leading-relaxed">
					{#if hasLocal}
						{t('Removes the `.rec` from your Company of Heroes playback folder. Keeps it in your library so you can download it again later.')}
					{:else}
						{t('No local playback file found for this replay.')}
					{/if}
				</span>
			</span>
		</button>

		<button
			type="button"
			class={cn(
				'border-destructive/30 bg-destructive/5 hover:border-destructive/50 hover:bg-destructive/10',
				'flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-colors',
				'disabled:cursor-not-allowed disabled:opacity-50'
			)}
			disabled={!!deleting}
			onclick={() => void confirm('everywhere')}
		>
			<span
				class="bg-destructive/15 text-destructive mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md"
			>
				{#if deleting === 'everywhere'}
					<span
						class="border-destructive size-4 animate-spin rounded-full border-2 border-t-transparent"
					></span>
				{:else}
					<TrashIcon size={18} />
				{/if}
			</span>
			<span class="min-w-0">
				<span class="text-destructive block text-sm font-medium">{t('Delete everywhere')}</span>
				<span class="text-secondary-400 mt-1 block text-sm leading-relaxed">
					{t('Removes it from your library and deletes the local playback file if it exists.')}
				</span>
			</span>
		</button>
	</div>

	<div class="flex justify-end">
		<Button type="button" variant="secondary" disabled={!!deleting} onclick={onCancel}>
			{t('Cancel')}
		</Button>
	</div>
</div>
