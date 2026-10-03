<script lang="ts">
	import { boot } from '$core/runtime/boot.svelte';
	import { Alert } from '$lib/components/ui/alert';
	import { Box } from '$lib/components/ui/box';
	import { Button } from '$lib/components/ui/button';
	import { getVersion } from '@tauri-apps/api/app';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import WrenchIcon from 'phosphor-svelte/lib/WrenchIcon';
	import SplashAnimated from './splash-animated.svelte';
	import { SPLASH_INTRO_MS, removeBootSplash } from './splash';
	import { expandToMain } from '$core/runtime/window-bounds';
	import { onMount } from 'svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const SERVER_POLL_MS = 15_000;

	let introComplete = $state(false);
	let version = $state<string | null>(null);

	const startIntroTimer = () => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			introComplete = true;
			boot.markSplashIntroComplete();
			return undefined;
		}

		introComplete = false;
		boot.splashIntroComplete = false;

		return window.setTimeout(() => {
			introComplete = true;
			boot.markSplashIntroComplete();
		}, SPLASH_INTRO_MS);
	};

	onMount(() => {
		removeBootSplash();
		getVersion()
			.then((value) => (version = value))
			.catch(() => {});
	});

	$effect(() => {
		if (boot.phase === 'error') {
			// The error card needs the full-size window.
			void expandToMain();
			return;
		}

		void boot.splashSession;

		const timer = startIntroTimer();

		return () => {
			if (timer !== undefined) {
				window.clearTimeout(timer);
			}
		};
	});

	$effect(() => {
		if (boot.phase === 'ready' && introComplete) {
			void boot.dismissSplash();
		}
	});

	// While the server is down, reconnect automatically once it answers again.
	$effect(() => {
		if (boot.phase !== 'error' || !boot.serverUnavailable) {
			return;
		}

		let checking = false;
		const interval = window.setInterval(async () => {
			if (checking) {
				return;
			}

			checking = true;
			if (await boot.isServerReachable()) {
				void boot.retry();
			}

			checking = false;
		}, SERVER_POLL_MS);

		return () => window.clearInterval(interval);
	});
</script>

{#if boot.phase === 'error'}
	<div
		class="bg-secondary-950 relative flex h-screen w-screen flex-col items-center justify-center gap-5 font-sans"
	>
		<div class="flex w-full max-w-xl flex-col gap-6 px-6 text-white">
			<div class="flex items-center gap-4 px-1">
				<SplashAnimated animate={false} size={40} />
				<div>
					<p class="font-medium">{t('Company of Heroes')}</p>
					<p class="text-secondary-400 text-sm">
						{boot.serverUnavailable ? t('Maintenance') : t('Startup failed')}
					</p>
				</div>
			</div>
			<Box class="flex flex-col gap-3">
				{#if boot.serverUnavailable}
					<div class="flex items-center gap-2">
						<WrenchIcon size={22} weight="duotone" class="text-warning" />
						<span class="font-semibold">{t('Maintenance in progress')}</span>
					</div>
					<p class="text-secondary-300 text-sm">
						{t(
							'Our server is temporarily unavailable while we perform maintenance. The app will be back online shortly and reconnects automatically.'
						)}
					</p>
				{:else}
					<div class="flex items-center gap-2">
						<WarningCircleIcon size={22} weight="duotone" class="text-destructive" />
						<span class="font-semibold">{t('The app could not start')}</span>
					</div>
					<p class="text-secondary-300 text-sm">
						{t(
							'Something went wrong while starting. Check your internet connection and try again.'
						)}
					</p>
				{/if}
				{#if boot.error && !boot.serverUnavailable}
					<Alert variant="destructive" size="sm" class="break-words select-text">
						{boot.error}
					</Alert>
				{/if}
				<div class="flex gap-2">
					<Button onclick={() => boot.retry()}>{t('Try again')}</Button>
				</div>
			</Box>
		</div>
	</div>
{:else}
	<!-- Frameless splash window: the whole surface drags the window. -->
	<div
		data-tauri-drag-region
		class="bg-secondary-950 relative flex h-screen w-screen cursor-default flex-col items-center justify-center gap-4 font-sans select-none"
	>
		<div class="loader pointer-events-none" aria-hidden="true"></div>
		<span class="sr-only">{t('Loading...')}</span>
		{#key boot.phase}
			<span class="phase-label text-secondary-500 pointer-events-none text-xs font-semibold">
				{boot.phaseLabel}
			</span>
		{/key}
		{#if version}
			<span class="text-secondary-700 pointer-events-none absolute bottom-3 text-[10px]">
				v{version}
			</span>
		{/if}
	</div>
{/if}

<style>
	.phase-label {
		animation: phase-fade 0.35s ease-out;
	}

	.loader {
		--w: 10ch;
		--c: var(--color-secondary-200);
		width: var(--w);
		overflow: hidden;
		font-family: monospace;
		font-size: 30px;
		font-weight: bold;
		line-height: 1.4em;
		letter-spacing: var(--w);
		white-space: nowrap;
		color: #0000;
		text-shadow:
			calc(0 * var(--w)) 0 var(--c),
			calc(-1 * var(--w)) 0 var(--c),
			calc(-2 * var(--w)) 0 var(--c),
			calc(-3 * var(--w)) 0 var(--c),
			calc(-4 * var(--w)) 0 var(--c),
			calc(-5 * var(--w)) 0 var(--c),
			calc(-6 * var(--w)) 0 var(--c),
			calc(-7 * var(--w)) 0 var(--c),
			calc(-8 * var(--w)) 0 var(--c),
			calc(-9 * var(--w)) 0 var(--c);
		animation: loader-wave 2s infinite linear;
	}

	.loader::before {
		content: 'Loading...';
	}

	@keyframes loader-wave {
		9.09% {
			text-shadow:
				calc(0 * var(--w)) -10px var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		18.18% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) -10px var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		27.27% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) -10px var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		36.36% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) -10px var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		45.45% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) -10px var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		54.55% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) -10px var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		63.64% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) -10px var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		72.73% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) -10px var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		81.82% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) -10px var(--c),
				calc(-9 * var(--w)) 0 var(--c);
		}

		90.91% {
			text-shadow:
				calc(0 * var(--w)) 0 var(--c),
				calc(-1 * var(--w)) 0 var(--c),
				calc(-2 * var(--w)) 0 var(--c),
				calc(-3 * var(--w)) 0 var(--c),
				calc(-4 * var(--w)) 0 var(--c),
				calc(-5 * var(--w)) 0 var(--c),
				calc(-6 * var(--w)) 0 var(--c),
				calc(-7 * var(--w)) 0 var(--c),
				calc(-8 * var(--w)) 0 var(--c),
				calc(-9 * var(--w)) -10px var(--c);
		}
	}

	@keyframes phase-fade {
		from {
			opacity: 0;
			transform: translateY(4px);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.phase-label,
		.loader {
			animation: none;
		}
	}
</style>
