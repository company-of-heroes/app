<script lang="ts">
	import { onMount } from 'svelte';
	import '../../../app.css';
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';

	let randomTexts = [
		'Loading assets...',
		'Preparing awesomeness...',
		'Just a moment...',
		'Getting things ready...',
		'Almost there...',
		'Hang tight...',
		'Cooking up some code...',
		'Warming up the pixels...',
		'Spinning the gears...',
		'Brewing some magic...'
	];
	let activeText = $state<string>();
	let interval: ReturnType<typeof setInterval> | undefined = $state();

	onMount(() => {
		activeText = randomTexts[Math.floor(Math.random() * randomTexts.length)];

		interval = setInterval(() => {
			activeText = randomTexts[Math.floor(Math.random() * randomTexts.length)];
		}, 2000);

		if (dev) {
			goto('/');
		}

		return () => {
			clearInterval(interval);
		};
	});
</script>

<div
	class="bg-secondary-950 flex h-screen w-screen flex-col items-center justify-center gap-4 font-sans"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		version="1.1"
		class="pacman3351 w-24"
		viewBox="50 0 500 300"
	>
		<circle class="pacman3351-dot" cx="250" cy="50%" r="10" /><circle
			class="pacman3351-dot"
			cx="350"
			cy="50%"
			r="10"
		/>
		<circle class="pacman3351-dot" cx="450" cy="50%" r="10" /><circle
			class="pacman3351-dot"
			cx="550"
			cy="50%"
			r="10"
		/>
		<circle class="pacman3351-dot" cx="650" cy="50%" r="10" />
		<path
			class="pacman3351-mouth-bottom"
			d="
        M 150,150
        L 220.4,221.0
        A 100 100 0 0 0 250,150
        Z"
		/>
		<path
			class="pacman3351-mouth-top"
			d="
        M 150,150 
        L 220.4,79.0
        A 100 100 0 0 1 250,150
        Z"
		/>
		<path
			class="pacman3351-open"
			d="
        M 150,150
        L 236.6,100
        A 100 100 0 1 0 236.6,200
        Z"
		/>
	</svg>
	<span class="text-secondary-600 font-semibold">{activeText}</span>
</div>

<style global>
	.pacman3351-dot {
		fill: var(--color-primary);
	}

	.pacman3351-open,
	.pacman3351-mouth-top,
	.pacman3351-mouth-bottom {
		fill: var(--color-secondary-300);
	}

	.pacman3351-mouth-top,
	.pacman3351-mouth-bottom {
		animation-duration: 175ms;
		animation-timing-function: linear;
		animation-direction: alternate;
		animation-iteration-count: infinite;
		transform-origin: calc(300px / 2) 150px;
	}

	.pacman3351-mouth-top {
		animation-name: rotate3351-counterclockwise;
	}

	.pacman3351-mouth-bottom {
		animation-name: rotate3351-clockwise;
	}

	@keyframes rotate3351-counterclockwise {
		100% {
			transform: rotate(-30deg);
		}
	}

	@keyframes rotate3351-clockwise {
		100% {
			transform: rotate(30deg);
		}
	}

	.pacman3351-dot {
		animation-name: dot3351-motion;
		animation-duration: 600ms;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	@keyframes dot3351-motion {
		100% {
			transform: translateX(-100px);
		}
	}
</style>
