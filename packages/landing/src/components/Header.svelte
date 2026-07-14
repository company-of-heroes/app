<script lang="ts">
	import logo from '@assets/logo-transparent-bg.png';
	import Button from './Button.svelte';
	import Link from './Link.svelte';
	import { cn, interactive } from '$lib/cn';
	import { latestDownload } from '$lib/download.svelte';
	import { DISCORD_URL } from '$lib/urls';

	const navLinks = [
		{ href: '/#features', label: 'Features' },
		{ href: '/#download', label: 'Download' },
		{ href: '/card', label: 'Player card' }
	];
</script>

<header
	class="border-secondary-800/80 bg-secondary-950/90 sticky top-0 z-50 border-b backdrop-blur-md"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
		<Link href="/" class="flex min-w-0 items-center gap-3">
			<img src={logo} alt="Company of Heroes Companion" class="size-10 shrink-0" />
			<div class="min-w-0">
				<p class="truncate text-sm font-semibold text-white">Company of Heroes</p>
				<p class="text-primary truncate text-xs font-medium">Companion</p>
			</div>
		</Link>

		<nav class="hidden items-center gap-6 md:flex">
			{#each navLinks as link (link.href)}
				<Link
					href={link.href}
					class="text-secondary-300 hover:text-primary text-sm font-medium transition-colors"
				>
					{link.label}
				</Link>
			{/each}
			<a
				href={DISCORD_URL}
				target="_blank"
				rel="noopener noreferrer"
				class={cn(interactive, 'text-secondary-300 hover:text-white text-sm font-medium transition-colors')}
			>
				Discord
			</a>
		</nav>

		<div class="flex shrink-0 items-center gap-2">
			<Button
				href={latestDownload.url}
				download={latestDownload.fileName}
				class="hidden sm:inline-flex"
			>
				Download for Windows
			</Button>
			<Button href={latestDownload.url} download={latestDownload.fileName} class="sm:hidden">
				Download
			</Button>
		</div>
	</div>
</header>
