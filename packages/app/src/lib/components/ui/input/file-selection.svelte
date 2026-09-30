<script lang="ts">
	import type { InputProps } from '.';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import { Button } from '../button';
	import { open, type DialogFilter } from '@tauri-apps/plugin-dialog';
	import { watch } from 'runed';
	import { exists } from '@tauri-apps/plugin-fs';
	import { cn } from '$lib/utils';
	import { controlBase } from '../variants';
	import { useI18n } from '$lib/i18n';

	let {
		value = $bindable(),
		directory = false,
		type: _type,
		onSelect,
		filters,
		defaultPath,
		showStatus = true,
		class: className,
		..._restProps
	}: InputProps & {
		filters?: DialogFilter[];
		directory?: boolean;
		onSelect?: (path: string) => void;
		defaultPath?: string;
		showStatus?: boolean;
	} = $props();
	const { t } = useI18n();
	let fileExists = $state(false);

	const selectDir = async () => {
		const selectedPath = await open({
			defaultPath: defaultPath ?? value,
			multiple: false,
			directory,
			filters
		});
		if (!selectedPath) {
			return;
		}

		value = selectedPath;
		onSelect?.(value);
	};
	watch(
		() => value,
		(path) => {
			if (!path) {
				fileExists = false;
				return;
			}

			let cancelled = false;
			exists(path)
				.then((result) => {
					if (!cancelled) {
						fileExists = result;
					}
				})
				.catch(() => {
					if (!cancelled) {
						fileExists = false;
					}
				});
			return () => {
				cancelled = true;
			};
		}
	);
</script>

<div class={cn('flex w-full min-w-0 flex-col', className)}>
	<div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
		<div
			class={cn(
				controlBase,
				'flex min-w-0 items-center truncate px-4 select-text',
				value ? 'text-secondary-400' : 'text-secondary-600'
			)}
			title={value}
		>
			{value || t('No path selected')}
		</div>
		<Button variant="secondary" type="button" onclick={selectDir} class="w-fit shrink-0">
			<FolderOpenIcon size={16} />
			{t('Select')}
		</Button>
	</div>
	{#if showStatus && value}
		<div
			class={cn(
				'mt-2 flex items-center gap-1 text-sm',
				fileExists ? 'text-green-500' : 'text-red-500'
			)}
		>
			{#if fileExists}
				<CheckCircleIcon weight="duotone" size={18} />
				{t('Path exists')}
			{:else}
				<WarningCircleIcon weight="duotone" size={18} />
				{t('Path does not exist')}
			{/if}
		</div>
	{/if}
</div>
