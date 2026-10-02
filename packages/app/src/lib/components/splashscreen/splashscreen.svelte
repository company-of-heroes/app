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
	import { SPLASH_TIPS, SPLASH_TIP_MS } from './tips';
	import { onMount } from 'svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const SERVER_POLL_MS = 15_000;
	const PHASE_STEPS = ['idle', 'settings', 'account', 'services', 'features', 'game', 'ready'];

	let introComplete = $state(false);
	let version = $state<string | null>(null);
	let tipIndex = $state(Math.floor(Math.random() * SPLASH_TIPS.length));

	const progress = $derived.by(() => {
		const phase = boot.phase === 'onboarding' ? 'settings' : boot.phase;
		const step = Math.max(PHASE_STEPS.indexOf(phase), 0);
		return ((step + 1) / PHASE_STEPS.length) * 100;
	});

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
		const interval = window.setInterval(() => {
			tipIndex = (tipIndex + 1) % SPLASH_TIPS.length;
		}, SPLASH_TIP_MS);

		return () => window.clearInterval(interval);
	});

	$effect(() => {
		if (boot.phase === 'error') {
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

<div
	class="bg-secondary-950 relative flex h-screen w-screen flex-col items-center justify-center gap-5 font-sans"
>
	{#if boot.phase === 'error'}
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
	{:else}
		{#key boot.splashSession}
			<SplashAnimated />
		{/key}
		<div class="mt-6 flex flex-col items-center gap-3">
			{#key boot.phase}
				<span class="phase-label text-secondary-300 font-semibold">{boot.phaseLabel}</span>
			{/key}
			<div class="bg-secondary-800 h-[3px] w-52 overflow-hidden rounded-full" aria-hidden="true">
				<div class="progress-fill bg-primary h-full rounded-full" style:width="{progress}%"></div>
			</div>
		</div>
		<div class="mt-10 h-12 max-w-sm px-6 text-center text-sm">
			{#key tipIndex}
				<p class="tip text-secondary-500">
					<span class="text-primary font-semibold">{t('Did you know?')}</span>
					{t(SPLASH_TIPS[tipIndex])}
				</p>
			{/key}
		</div>
		{#if version}
			<span class="text-secondary-600 absolute bottom-4 text-xs">v{version}</span>
		{/if}
	{/if}
</div>

<style>
	.phase-label,
	.tip {
		animation: phase-fade 0.35s ease-out;
	}

	.progress-fill {
		transition: width 0.4s ease;
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
		.tip {
			animation: none;
		}

		.progress-fill {
			transition: none;
		}
	}
</style>
