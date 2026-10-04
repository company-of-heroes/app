<script lang="ts">
	import '../../../app.css';
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert } from '$lib/components/ui/alert';
	import { FileSelection } from '$lib/components/ui/input';
	import { Toaster, toast } from '$lib/components/ui/toasts';
	import { surfacePanel } from '$lib/components/ui/variants';
	import AccountSignIn from '$lib/components/account/account-sign-in.svelte';
	import { onMount } from 'svelte';
	import { watch } from 'runed';
	import { boot } from '$core/runtime/boot.svelte';
	import { expandToMain } from '$core/runtime/window-bounds';
	import { settings } from '$core/config/settings.svelte';
	import {
		defaultGameDirPath,
		defaultWarningsLogDir,
		defaultWarningsLogPath,
		detectGameDir,
		detectWarningsLog,
		validateGameDir,
		validateWarningsLog,
		type PathValidation
	} from '$core/config/paths';
	import Logo from '$lib/files/logo-transparent-bg.png?url';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useI18n } from '$lib/i18n';
	import { exists } from '@tauri-apps/plugin-fs';
	import { revealItemInDir } from '@tauri-apps/plugin-opener';
	import { dirname } from '@tauri-apps/api/path';

	const { t } = useI18n();

	let logValidation = $state<PathValidation>({ valid: false });
	let dirValidation = $state<PathValidation>({ valid: false });
	let isFinishing = $state(false);
	let isDetecting = $state(false);
	let expectedLogPath = $state('');
	let expectedLogDir = $state('');
	let expectedGameDir = $state('');
	let detectedLog = $state<string | null>(null);
	let detectedGame = $state<string | null>(null);
	let step = $state<'account' | 'paths'>('account');

	const pathsComplete = $derived(logValidation.valid && dirValidation.valid);
	const logAutoDetected = $derived(
		!!detectedLog && settings.tree.app.companyOfHeroesConfigPath === detectedLog
	);
	const gameAutoDetected = $derived(
		!!detectedGame && settings.tree.app.companyOfHeroesInstallationPath === detectedGame
	);

	watch(
		() => settings.tree.app.companyOfHeroesConfigPath,
		(path) => {
			validateWarningsLog(path).then((result) => {
				logValidation = result;
			});
		}
	);

	watch(
		() => settings.tree.app.companyOfHeroesInstallationPath,
		(path) => {
			validateGameDir(path).then((result) => {
				dirValidation = result;
			});
		}
	);

	const detectPaths = async () => {
		isDetecting = true;
		try {
			expectedLogPath = await defaultWarningsLogPath();
			expectedLogDir = await defaultWarningsLogDir();
			expectedGameDir = await defaultGameDirPath();
			const [log, game] = await Promise.all([detectWarningsLog(), detectGameDir()]);
			detectedLog = log;
			detectedGame = game;
			if (log) {
				const current = settings.tree.app.companyOfHeroesConfigPath;
				const currentOk = current ? (await validateWarningsLog(current)).valid : false;
				if (!current || !currentOk) {
					settings.tree.app.companyOfHeroesConfigPath = log;
				}
			}

			if (game) {
				expectedGameDir = game;
				const current = settings.tree.app.companyOfHeroesInstallationPath;
				const currentOk = current ? (await validateGameDir(current)).valid : false;
				if (!current || !currentOk) {
					settings.tree.app.companyOfHeroesInstallationPath = game;
				}
			}
		} finally {
			isDetecting = false;
		}
	};

	onMount(() => {
		void expandToMain();
		void detectPaths();
	});

	const revealPath = async (selected: string, fallback: string) => {
		const candidates = [selected, fallback].filter(Boolean);
		for (const candidate of candidates) {
			if (!(await exists(candidate))) {
				continue;
			}

			try {
				await revealItemInDir(candidate);
				return;
			} catch {
				try {
					await revealItemInDir(await dirname(candidate));
					return;
				} catch {
					// try the next candidate
				}
			}
		}
		toast.error(t('Could not open this location. Use Select to browse to it.'));
	};

	const showPaths = () => {
		step = 'paths';
	};

	const finish = async () => {
		isFinishing = true;
		try {
			await boot.completeOnboarding();
		} finally {
			isFinishing = false;
		}
	};
</script>

<div class="flex min-h-screen w-screen justify-center overflow-auto bg-gray-950/90 font-sans">
	<div class="flex w-full max-w-xl flex-col gap-6 px-6 py-12 text-white">
		<div class="flex items-center gap-4 px-1">
			<img src={Logo} alt={t('Fknoobscoh - CoH app')} class="size-10" />
			<div>
				<p class="font-medium">{t('Company of Heroes')}</p>
				<p class="text-secondary-400 text-sm">
					{step === 'account' ? t('Log in') : t('Setup')}
				</p>
			</div>
		</div>
		{#if step === 'account'}
			<p class="text-secondary-400 px-1 text-sm">
				{t('Log in with your coh1stats.com account.')}
			</p>
		{:else}
			<p class="text-secondary-400 px-1 text-sm">
				{t(
					'Tell the app where Company of Heroes lives so it can track your games. You can skip this and set it later in Settings.'
				)}
			</p>
		{/if}
		{#if boot.signInMessage && step === 'account'}
			<Alert variant="warning" size="sm">{boot.signInMessage}</Alert>
		{/if}

		{#if step === 'account'}
			<div class={surfacePanel}>
				<AccountSignIn onSignedIn={showPaths} onAnonymous={showPaths} />
			</div>
		{:else}
			<div class={surfacePanel}>
				<Form.Root
					onsubmit={(event) => {
						event.preventDefault();
						if (isFinishing) {
							return;
						}

						void finish();
					}}
				>
					<Form.Group label={t('Company of Heroes warnings.log')} layout="stacked">
						{#snippet hint()}
							{#if logAutoDetected}
								<Badge variant="success">{t('Detected')}</Badge>
							{/if}
						{/snippet}
						{#snippet description()}
							<p>
								{t('The game writes match data to this log file.')}
								{t(
									'If this file is missing, launch Company of Heroes once. The game creates it automatically.'
								)}
							</p>
							{#if expectedLogPath}
								<p class="mt-2">
									<span class="text-secondary-500">{t('Default location')}</span>
									<code class="text-secondary-200 mt-0.5 block break-all select-text">
										{expectedLogPath}
									</code>
								</p>
							{/if}
						{/snippet}
						<FileSelection
							bind:value={settings.tree.app.companyOfHeroesConfigPath}
							filters={[{ name: 'warnings.log', extensions: ['log'] }]}
							defaultPath={settings.tree.app.companyOfHeroesConfigPath || expectedLogDir}
						/>
						<div
							class={[
								'flex items-center gap-1 text-sm',
								logValidation.valid ? 'text-green-500' : 'text-red-500'
							]}
						>
							{#if logValidation.valid}
								<CheckCircleIcon weight="duotone" size={18} />
								{t('warnings.log found')}
							{:else}
								<WarningCircleIcon weight="duotone" size={18} />
								{logValidation.reason ?? t('Select your warnings.log')}
							{/if}
						</div>
						{#snippet footer()}
							<Button
								variant="secondary"
								size="sm"
								type="button"
								loading={isDetecting}
								onclick={() => detectPaths()}
							>
								<MagnifyingGlassIcon size={16} />
								{t('Look again')}
							</Button>
							<Button
								variant="secondary"
								size="sm"
								type="button"
								onclick={() =>
									revealPath(settings.tree.app.companyOfHeroesConfigPath, expectedLogDir)}
							>
								<ArrowSquareOutIcon size={16} />
								{t('Show in Explorer')}
							</Button>
						{/snippet}
					</Form.Group>
					<Form.Group label={t('Company of Heroes installation folder')} layout="stacked">
						{#snippet hint()}
							{#if gameAutoDetected}
								<Badge variant="success">{t('Detected')}</Badge>
							{/if}
						{/snippet}
						{#snippet description()}
							<p>
								{t(
									'The folder that contains RelicCOH.exe. Steam usually installs it under steamapps\\common\\Company of Heroes Relaunch.'
								)}
								{t(
									'We search your Steam libraries automatically. If nothing shows up, pick the folder yourself.'
								)}
							</p>
							{#if expectedGameDir}
								<p class="mt-2">
									<span class="text-secondary-500">{t('Default location')}</span>
									<code class="text-secondary-200 mt-0.5 block break-all select-text">
										{expectedGameDir}
									</code>
								</p>
							{/if}
						{/snippet}
						<FileSelection
							directory
							bind:value={settings.tree.app.companyOfHeroesInstallationPath}
							defaultPath={settings.tree.app.companyOfHeroesInstallationPath || expectedGameDir}
						/>
						<div
							class={[
								'flex items-center gap-1 text-sm',
								dirValidation.valid ? 'text-green-500' : 'text-red-500'
							]}
						>
							{#if dirValidation.valid}
								<CheckCircleIcon weight="duotone" size={18} />
								{t('Installation found')}
							{:else}
								<WarningCircleIcon weight="duotone" size={18} />
								{dirValidation.reason ?? t('Select your installation folder')}
							{/if}
						</div>
						{#snippet footer()}
							<Button
								variant="secondary"
								size="sm"
								type="button"
								loading={isDetecting}
								onclick={() => detectPaths()}
							>
								<MagnifyingGlassIcon size={16} />
								{t('Look again')}
							</Button>
							<Button
								variant="secondary"
								size="sm"
								type="button"
								onclick={() =>
									revealPath(settings.tree.app.companyOfHeroesInstallationPath, expectedGameDir)}
							>
								<ArrowSquareOutIcon size={16} />
								{t('Show in Explorer')}
							</Button>
						{/snippet}
					</Form.Group>
					<div class="border-secondary-800 flex items-center justify-end gap-3 border-t px-4 py-3">
						{#if !pathsComplete}
							<span class="text-secondary-500 mr-auto text-sm">
								{t(
									'Without these, live game tracking, match recording, replay analysis and fair play stay off. You can set them later in Settings.'
								)}
							</span>
						{/if}
						<Button type="submit" loading={isFinishing}>
							{pathsComplete ? t('Continue') : t('Skip for now')}
						</Button>
					</div>
				</Form.Root>
			</div>
		{/if}
	</div>
</div>

<Toaster />
