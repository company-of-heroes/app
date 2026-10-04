<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { getVersion } from '@tauri-apps/api/app';
	import { Toaster } from '@company-of-heroes/ui/toasts';
	import { Dialog } from '@company-of-heroes/ui/dialog';
	import { Modal, modal } from '@company-of-heroes/ui/modal';
	import { Button } from '@company-of-heroes/ui/button';
	import { BootSplash } from '@company-of-heroes/ui/splash';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import logo from '$lib/assets/logo-gold.png';
	import pageBackgroundImage from '@assets/assets/art_ui_textures_textures_fe_bkg_cxp1.png';
	import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwiseIcon';
	import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import { openPath, openUrl } from '@tauri-apps/plugin-opener';
	import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';
	import HandCoinsIcon from 'phosphor-svelte/lib/HandCoinsIcon';
	import TwitchLogoIcon from 'phosphor-svelte/lib/TwitchLogoIcon';
	import CompanionDownloadButton from '$lib/components/companion-download-button.svelte';
	import LanguageMenu from '$lib/components/language-menu.svelte';
	import ReplayParserSettings from '$lib/components/replay-parser-settings.svelte';
	import WindowControls from '$lib/components/window-controls.svelte';
	import { provideI18n, useI18n } from '$lib/i18n';
	import { provideLocalHost } from '$lib/host';
	import { createReplayLibrary, ReplayLibrary } from '$lib/library/replay-library.svelte';
	import { expandToMain } from '$lib/window';
	import type { LayoutProps } from './$types';

	import '../../../app/src/lib/fonts/TT Mussels/style.css';
	import '@fontsource/nunito-sans/800.css';
	import '../app.css';

	let { children, data }: LayoutProps = $props();

	provideI18n(() => data.i18n);
	provideLocalHost();
	const { t } = useI18n();
	const library = createReplayLibrary(new ReplayLibrary());
	/** Minimum time the splash stays up, same as the companion app. */
	const SPLASH_INTRO_MS = 800;

	let initFailed = $state(false);
	let introComplete = $state(false);
	let booted = $state(false);
	let version = $state<string | null>(null);
	const bootLabel = $derived(library.ready ? t('Reading replays...') : t('Starting...'));

	library.init().catch((error) => {
		console.error('[replay-manager] init failed', error);
		initFailed = true;
	});
	onDestroy(() => library.destroy());

	onMount(() => {
		document.getElementById('boot-splash')?.remove();
		getVersion()
			.then((value) => (version = value))
			.catch(() => {});
		const timer = window.setTimeout(() => (introComplete = true), SPLASH_INTRO_MS);
		return () => window.clearTimeout(timer);
	});

	$effect(() => {
		if (booted || !introComplete || !(library.listed || initFailed)) {
			return;
		}

		void expandToMain().then(() => (booted = true));
	});

	const WEBSITE_URL = 'https://coh1stats.com';
	/** Same PayPal link as the website's donation section. */
	const PAYPAL_URL = 'https://www.paypal.com/donate/?hosted_button_id=8BMSUSF6RY73N';
	const TWITCH_URL = 'https://www.twitch.tv/fknoobscoh';

	/** Small quiet icon buttons; the window controls sit in the corner next to them. */
	const headerAction = 'text-secondary-400 hover:bg-secondary-800/60 hover:text-white';

	let openingFolder = $state(false);

	async function openPlaybackFolder() {
		if (!library.playbackDir) {
			return;
		}

		openingFolder = true;
		try {
			await openPath(library.playbackDir);
		} finally {
			openingFolder = false;
		}
	}

	function openSettings() {
		modal.create({
			title: t('Settings'),
			size: 'md',
			component: ReplayParserSettings,
			props: { library, onDone: () => modal.close() }
		});
		modal.open();
	}
</script>

{#if booted}
	<div class="flex h-screen flex-col overflow-hidden font-sans">
		<!-- No native title bar: the header drags the window and holds the window controls. -->
		<header
			data-tauri-drag-region
			class="border-secondary-800 relative flex h-10 shrink-0 items-stretch border-b bg-gray-950 select-none"
		>
			<a href="/" class={cn(interactive, 'flex min-w-0 items-center gap-2.5 ps-2.5 pe-3')}>
				<img src={logo} alt="" class="size-6 shrink-0 rounded-full" />
				<p class="truncate text-sm font-medium text-white">{t('Company of Heroes')}</p>
			</a>
			<div data-tauri-drag-region class="grow"></div>
			<div class="flex shrink-0 items-center gap-1 pe-2">
				<CompanionDownloadButton />
				<Button
					variant="ghost"
					size="sm"
					class={cn(headerAction, 'me-1 h-7 px-2.5')}
					onclick={() => void openUrl(WEBSITE_URL)}
				>
					<GlobeIcon size={16} weight="duotone" />
					{t('Visit website')}
				</Button>
				<LanguageMenu class={cn(headerAction, 'me-1')} />
				<Button
					variant="ghost"
					size="icon-sm"
					class={headerAction}
					title={t('Refresh')}
					aria-label={t('Refresh')}
					loading={library.scanning}
					onclick={() => void library.scan()}
				>
					<ArrowClockwiseIcon class="size-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					class={headerAction}
					title={t('Settings')}
					aria-label={t('Settings')}
					onclick={openSettings}
				>
					<GearSixIcon class="size-4" />
				</Button>
				<span class="bg-secondary-700 ms-1 h-5 w-px" aria-hidden="true"></span>
			</div>
			<WindowControls />
		</header>
		<div class="relative flex min-h-0 w-full flex-1 flex-col bg-gray-950">
			<!-- Same textured backdrop as the website's page gutters. -->
			<div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
				<img src={pageBackgroundImage} alt="" class="size-full object-cover" />
				<div class="absolute inset-0 bg-gray-950/95 mix-blend-color"></div>
				<div class="absolute inset-0 bg-gray-950/85"></div>
			</div>
			<!-- -mb-px: a page's bottom border slides under the footer's top border instead of doubling it. -->
			<div class="relative -mb-px min-h-0 flex-1 overflow-y-auto bg-gray-950/90">
				{@render children()}
			</div>
			<footer
				class="border-secondary-800 relative flex h-10 shrink-0 items-center border-t bg-gray-950 select-none"
			>
				<p class="text-secondary-500 min-w-0 truncate ps-3 pe-3 text-sm">
					{library.playbackDir ?? t('Playback folder not found')}
				</p>
				<Button
					variant="ghost"
					size="sm"
					class={cn(headerAction, 'ms-auto me-1 h-7 shrink-0 px-2.5')}
					onclick={() => void openUrl(TWITCH_URL)}
				>
					<TwitchLogoIcon size={16} weight="duotone" />
					Twitch
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class={cn(headerAction, 'me-1 h-7 shrink-0 px-2.5', !library.playbackDir && 'me-2')}
					onclick={() => void openUrl(PAYPAL_URL)}
				>
					<HandCoinsIcon size={16} weight="duotone" />
					{t('Donate')}
				</Button>
				{#if library.playbackDir}
					<Button
						variant="secondary"
						size="sm"
						class="me-2 h-7 shrink-0 px-2.5"
						loading={openingFolder}
						onclick={() => void openPlaybackFolder()}
					>
						{#if !openingFolder}
							<FolderOpenIcon class="size-4" />
						{/if}
						{t('Open folder')}
					</Button>
				{/if}
			</footer>
		</div>
	</div>
{:else}
	<BootSplash label={bootLabel} {version} loadingLabel={t('Loading...')} />
{/if}
<Dialog />
<Modal />
<Toaster />
