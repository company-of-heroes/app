<script lang="ts">
	import { cn, interactive } from '$lib/cn';
	import { API_URL, DISCORD_URL, GITHUB_URL, TWITCH_URL } from '$lib/urls';

	const links = [
		{ href: GITHUB_URL, label: 'GitHub' },
		{ href: DISCORD_URL, label: 'Discord' },
		{ href: TWITCH_URL, label: 'Twitch' },
		{ href: API_URL, label: 'API' }
	];
</script>

<footer class="border-secondary-800/80 border-t">
	<div
		class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row"
	>
		<p class="text-secondary-500 text-sm">© {new Date().getFullYear()} Code IT · Fknoobs</p>
		<nav class="flex flex-wrap items-center justify-center gap-6">
			{#each links as link (link.href)}
				<a
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
					class={cn(interactive, 'text-secondary-400 hover:text-primary text-sm transition-colors')}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	</div>
</footer>
