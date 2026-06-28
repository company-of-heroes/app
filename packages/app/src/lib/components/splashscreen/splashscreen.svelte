<script lang="ts">
	import { boot } from '$core/runtime/boot.svelte';
	import { Button } from '$lib/components/ui/button';
	import SplashAnimated from './splash-animated.svelte';
	import { SPLASH_INTRO_MS, removeBootSplash } from './splash';
	import { onMount } from 'svelte';

	let introComplete = $state(false);

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
</script>

<div
	class="bg-secondary-950 flex h-screen w-screen flex-col items-center justify-center gap-5 font-sans"
>
	{#if boot.phase === 'error'}
		<SplashAnimated animate={false} />
		<span class="text-2xl font-semibold text-red-400">Startup failed</span>
		<p class="text-secondary-400 max-w-md text-center text-sm">
			{boot.error}
		</p>
		<Button variant="secondary" onclick={() => boot.retry()}>Try again</Button>
	{:else}
		{#key boot.splashSession}
			<SplashAnimated />
		{/key}
		{#key boot.phase}
			<span class="phase-label text-secondary-600 font-semibold">{boot.phaseLabel}</span>
		{/key}
		<div class="loading-dots" aria-hidden="true">
			<span></span>
			<span></span>
			<span></span>
		</div>
	{/if}
</div>

<style>
	.phase-label {
		animation: phase-fade 0.35s ease-out;
	}

	.loading-dots {
		display: flex;
		gap: 0.4rem;
		margin-top: -0.25rem;
	}

	.loading-dots span {
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 9999px;
		background: var(--color-primary);
		opacity: 0.35;
		animation: dot-pulse 1.2s ease-in-out infinite;
	}

	.loading-dots span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.loading-dots span:nth-child(3) {
		animation-delay: 0.4s;
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

	@keyframes dot-pulse {
		0%,
		100% {
			opacity: 0.25;
			transform: scale(1);
		}

		50% {
			opacity: 1;
			transform: scale(1.15);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.phase-label {
			animation: none;
		}

		.loading-dots span {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
