<script lang="ts">
	type Props = {
		size?: number | string;
		animate?: boolean;
	};

	let { size = 48, animate = true }: Props = $props();

	const dimension = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<div
	class="splash-spinner"
	class:splash-spinner--animate={animate}
	style:width={dimension}
	style:height={dimension}
	role="status"
	aria-label="Loading"
></div>

<style>
	.splash-spinner {
		display: block;
		flex-shrink: 0;
		border-radius: 9999px;
		border: 2.5px solid color-mix(in oklch, var(--color-secondary-700) 55%, transparent);
		border-top-color: var(--color-primary);
	}

	.splash-spinner--animate {
		animation:
			spinner-fade-in 0.35s ease-out,
			spinner-spin 1.5s linear infinite;
	}

	@keyframes spinner-fade-in {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@keyframes spinner-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.splash-spinner--animate {
			animation: none;
			opacity: 1;
		}
	}
</style>
