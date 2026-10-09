<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
	import SquareIcon from 'phosphor-svelte/lib/SquareIcon';
	import CopySimpleIcon from 'phosphor-svelte/lib/CopySimpleIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useI18n } from '$lib/i18n';
	import { tooltip } from '@company-of-heroes/ui/attachments';

	const { t } = useI18n();
	const appWindow = getCurrentWindow();

	let maximized = $state(false);
	let unlisten: (() => void) | null = null;

	const sync = async () => {
		maximized = await appWindow.isMaximized();
	};

	void sync();
	void appWindow.onResized(() => void sync()).then((stop) => (unlisten = stop));
	onDestroy(() => unlisten?.());

	/** Slim top-right buttons, like native Windows caption buttons. */
	const control = cn(
		interactive,
		'text-secondary-400 flex h-full w-11 items-center justify-center transition-colors hover:text-white'
	);
</script>

<div class="flex h-full items-stretch">
	<button
		type="button"
		class={cn(control, 'hover:bg-secondary-800/60')}
		{@attach tooltip(t('Minimize'))}
		aria-label={t('Minimize')}
		onclick={() => void appWindow.minimize()}
	>
		<MinusIcon class="size-3.5" weight="light" />
	</button>
	<button
		type="button"
		class={cn(control, 'hover:bg-secondary-800/60')}
		{@attach tooltip(maximized ? t('Restore') : t('Maximize'))}
		aria-label={maximized ? t('Restore') : t('Maximize')}
		onclick={() => void appWindow.toggleMaximize()}
	>
		{#if maximized}
			<CopySimpleIcon class="size-3.5 -scale-x-100" weight="light" />
		{:else}
			<SquareIcon class="size-3" weight="light" />
		{/if}
	</button>
	<button
		type="button"
		class={cn(control, 'hover:bg-red-600')}
		{@attach tooltip(t('Close'))}
		aria-label={t('Close')}
		onclick={() => void appWindow.close()}
	>
		<XIcon class="size-3.5" weight="light" />
	</button>
</div>
