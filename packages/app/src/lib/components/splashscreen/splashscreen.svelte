<script lang="ts">
	import { boot } from '$core/runtime/boot.svelte';
	import { Alert } from '$lib/components/ui/alert';
	import { Box } from '$lib/components/ui/box';
	import { Button } from '$lib/components/ui/button';
	import { getVersion } from '@tauri-apps/api/app';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import WrenchIcon from 'phosphor-svelte/lib/WrenchIcon';
	import { BootSplash } from '@company-of-heroes/ui/splash';
	import { removeBootSplash } from './splash';
	import logo64 from '@assets/logo/logo-64.webp';
	import logo128 from '@assets/logo/logo-128.webp';
	import { expandToMain } from '$core/runtime/window-bounds';
	import { onMount } from 'svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const SERVER_POLL_MS = 15_000;

	let version = $state<string | null>(null);

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
		}
	});

	$effect(() => {
		if (boot.phase === 'ready') {
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
				<img
					src={logo64}
					srcset="{logo64} 1x, {logo128} 2x"
					alt={t('Fknoobscoh - CoH app')}
					class="-my-3 size-14"
				/>
				<div>
					<p class="font-medium">{t('Global Community')}</p>
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
	<BootSplash label={boot.phaseLabel} {version} loadingLabel={t('Loading...')} />
{/if}
