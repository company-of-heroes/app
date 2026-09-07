<script lang="ts">
	import DiscordMenu from '$lib/components/layout/discord-menu.svelte';
	import LocaleSwitcher from '$lib/components/layout/locale-switcher.svelte';
	import { cn } from '$lib/utils/cn';
	import { API_URL, GITHUB_URL, TWITCH_URL } from '$lib/site/urls';
	import { href, useI18n } from '$lib/i18n';
	import { interactive } from '$lib/utils/variants';

	const { t } = useI18n();

	const footerLink =
		'border-secondary-800 text-secondary-400 hover:bg-secondary-950/50 hover:text-white flex items-center border-l px-3 py-3 text-sm transition-colors sm:px-4';
</script>

<footer class="border-secondary-800 border-t">
	<div class="flex flex-wrap items-stretch">
		<p class="text-secondary-500 px-4 py-3 text-sm">
			© {new Date().getFullYear()} Code IT · Fknoobs
		</p>
		<nav class="ms-auto flex flex-wrap items-stretch">
			<div class="flex items-stretch sm:hidden">
				<LocaleSwitcher side="top" />
			</div>
			<a href={href('/privacy')} class={cn(interactive, footerLink)}>{t('Privacy')}</a>
			<a
				href={GITHUB_URL}
				target="_blank"
				rel="noopener noreferrer"
				class={cn(interactive, footerLink)}
			>
				GitHub
			</a>
			<DiscordMenu class={footerLink}>Discord</DiscordMenu>
			<a
				href={TWITCH_URL}
				target="_blank"
				rel="noopener noreferrer"
				class={cn(interactive, footerLink)}
			>
				Twitch
			</a>
			<a
				href={API_URL}
				target="_blank"
				rel="noopener noreferrer"
				class={cn(interactive, footerLink)}
			>
				API
			</a>
		</nav>
	</div>
</footer>
