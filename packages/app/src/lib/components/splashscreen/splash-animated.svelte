<script lang="ts">
	import { useI18n } from '$lib/i18n';

	type Props = {
		size?: number | string;
		animate?: boolean;
	};

	let { size = 96, animate = true }: Props = $props();
	const { t } = useI18n();
	const uid = $props.id();

	const dimension = $derived(typeof size === 'number' ? `${size}px` : size);
	const barClip = $derived(`splash-logo-bar-${uid}`);
	const stemClip = $derived(`splash-logo-stem-${uid}`);
</script>

<div
	class="splash-logo"
	class:splash-logo--animate={animate}
	style:width={dimension}
	style:height={dimension}
	role="status"
	aria-label={t('Loading')}
>
	<svg class="splash-logo-mark" viewBox="0 0 1024 1024" aria-hidden="true">
		<defs>
			<clipPath id={barClip}>
				<polygon points="150,280 873,280 833,434 298,434" />
			</clipPath>
			<clipPath id={stemClip}>
				<polygon points="285,487 765,487 737,589 470,589 414,797 201,797" />
			</clipPath>
		</defs>
		<circle class="splash-logo-disc" cx="512" cy="512" r="490" />
		<circle class="splash-logo-ring" cx="512" cy="512" r="490" pathLength="1" />
		<!-- Thick strokes clipped to the F shapes, so each part is wiped in like a pen stroke. -->
		<line
			class="splash-logo-stroke splash-logo-bar"
			x1="140"
			y1="357"
			x2="885"
			y2="357"
			stroke-width="170"
			pathLength="1"
			clip-path="url(#{barClip})"
		/>
		<line
			class="splash-logo-stroke splash-logo-leg"
			x1="380"
			y1="470"
			x2="297"
			y2="840"
			stroke-width="240"
			pathLength="1"
			clip-path="url(#{stemClip})"
		/>
		<line
			class="splash-logo-stroke splash-logo-arm"
			x1="400"
			y1="538"
			x2="780"
			y2="538"
			stroke-width="120"
			pathLength="1"
			clip-path="url(#{stemClip})"
		/>
	</svg>
</div>

<style>
	.splash-logo {
		flex-shrink: 0;
	}

	.splash-logo-mark {
		display: block;
		width: 100%;
		height: 100%;
	}

	.splash-logo-disc {
		fill: oklch(18% 0.003 285);
	}

	.splash-logo-ring {
		fill: none;
		stroke: white;
		stroke-width: 30;
		stroke-dasharray: 1;
		stroke-dashoffset: 0;
		transform: rotate(-90deg);
		transform-origin: 512px 512px;
	}

	.splash-logo-stroke {
		stroke: white;
		stroke-dasharray: 1;
		stroke-dashoffset: 0;
	}

	.splash-logo--animate .splash-logo-ring {
		animation: logo-draw 0.8s cubic-bezier(0.65, 0, 0.35, 1) both;
	}

	.splash-logo--animate .splash-logo-bar {
		animation: logo-draw 0.4s cubic-bezier(0.65, 0, 0.35, 1) 0.5s both;
	}

	.splash-logo--animate .splash-logo-leg {
		animation: logo-draw 0.35s cubic-bezier(0.65, 0, 0.35, 1) 0.75s both;
	}

	.splash-logo--animate .splash-logo-arm {
		animation: logo-draw 0.3s cubic-bezier(0.65, 0, 0.35, 1) 0.95s both;
	}

	@keyframes logo-draw {
		from {
			stroke-dashoffset: 1;
		}

		to {
			stroke-dashoffset: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.splash-logo--animate .splash-logo-ring,
		.splash-logo--animate .splash-logo-stroke {
			animation: none;
		}
	}
</style>
