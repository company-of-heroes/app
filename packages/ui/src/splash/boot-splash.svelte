<script lang="ts">
	type Props = {
		/** Current boot step, e.g. "Starting...". */
		label: string;
		version?: string | null;
		loadingLabel?: string;
	};

	let { label, version = null, loadingLabel = 'Loading...' }: Props = $props();
</script>

<!-- Frameless splash window: the whole surface drags the window. -->
<div
	data-tauri-drag-region
	class="bg-secondary-950 relative flex h-screen w-screen cursor-default flex-col items-center justify-center gap-4 font-sans select-none"
>
	<div class="loader pointer-events-none" aria-hidden="true"></div>
	<span class="sr-only">{loadingLabel}</span>
	{#key label}
		<span class="phase-label text-secondary-500 pointer-events-none text-xs font-semibold">
			{label}
		</span>
	{/key}
	{#if version}
		<span class="text-secondary-700 pointer-events-none absolute bottom-3 text-[10px]">
			v{version}
		</span>
	{/if}
</div>

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
