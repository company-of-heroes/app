<script lang="ts">
	import '../../../app.css';
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { FileSelection } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { H } from '$lib/components/ui/h';
	import { Toaster, toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { watch } from 'runed';
	import { boot } from '$core/runtime/boot.svelte';
	import { settings } from '$core/config/settings.svelte';
	import {
		detectGameDir,
		detectWarningsLog,
		validateGameDir,
		validateWarningsLog,
		type PathValidation
	} from '$core/config/paths';
	import Logo from '$lib/files/logo-transparent-bg.png?url';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
	import ArchiveIcon from 'phosphor-svelte/lib/Archive';
	import dayjs from '$lib/dayjs';

	let logValidation = $state<PathValidation>({ valid: false });
	let dirValidation = $state<PathValidation>({ valid: false });
	let isRestoring = $state(false);
	let isFinishing = $state(false);
	let didDismissRestore = $state(false);

	const canFinish = $derived(logValidation.valid && dirValidation.valid);
	const showRestore = $derived(boot.restoreCandidate !== null && !didDismissRestore);

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

	onMount(async () => {
		// Best-effort auto-detection for empty paths.
		if (!settings.tree.app.companyOfHeroesConfigPath) {
			const detected = await detectWarningsLog();

			if (detected) {
				settings.tree.app.companyOfHeroesConfigPath = detected;
			}
		}

		if (!settings.tree.app.companyOfHeroesInstallationPath) {
			const detected = await detectGameDir();

			if (detected) {
				settings.tree.app.companyOfHeroesInstallationPath = detected;
			}
		}
	});

	const restoreBackup = async () => {
		const candidate = boot.restoreCandidate;

		if (!candidate) {
			return;
		}

		isRestoring = true;

		try {
			const result = await settings.replace(candidate.settings);

			if (!result.success) {
				toast.error(`Could not restore backup: ${result.error}`);
				return;
			}

			didDismissRestore = true;
			toast.success('Backup restored. Your account and settings are back.');
		} finally {
			isRestoring = false;
		}
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

<div class="bg-secondary-950 flex min-h-screen w-screen justify-center overflow-auto font-sans">
	<div class="flex w-full max-w-2xl flex-col gap-8 px-8 py-16 text-white">
		<div class="flex items-center gap-4">
			<img src={Logo} alt="Fknoobs - CoH app" class="size-12" />
			<div>
				<H level="1">Setup</H>
				<p class="text-secondary-400 text-sm">
					The app needs to know where Company of Heroes lives before it can track your games.
				</p>
			</div>
		</div>

		{#if showRestore}
			<div class="border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-lg border p-4">
				<div class="flex items-center gap-2">
					<ArchiveIcon size={22} weight="duotone" class="text-primary" />
					<span class="font-semibold">Backup found</span>
				</div>
				<p class="text-secondary-300 text-sm">
					We found a backup of your previous configuration (account and settings)
					{#if boot.restoreCandidate?.settings.updatedAt}
						from {dayjs(boot.restoreCandidate.settings.updatedAt).format('DD MMM YYYY, HH:mm')}.
					{:else}
						.
					{/if}
					Restoring it keeps your existing account and match history linked.
				</p>
				<div class="flex gap-2">
					<Button onclick={restoreBackup} loading={isRestoring}>Restore backup</Button>
					<Button variant="secondary" onclick={() => (didDismissRestore = true)}>
						Start fresh
					</Button>
				</div>
			</div>
		{/if}

		<Form.Root>
			<Form.Group>
				<Label>Company of Heroes warnings.log</Label>
				<Form.Description>
					The game writes everything the app needs to this log file. It usually lives in
					<code>Documents\My Games\Company of Heroes Relaunch\warnings.log</code>.
				</Form.Description>
				<FileSelection
					name="pathToConfig"
					bind:value={settings.tree.app.companyOfHeroesConfigPath}
					filters={[{ name: 'warnings.log', extensions: ['log'] }]}
				/>
				<div
					class="flex items-center gap-1 text-sm {logValidation.valid
						? 'text-green-500'
						: 'text-red-500'}"
				>
					{#if logValidation.valid}
						<CheckCircleIcon weight="duotone" size={18} />
						warnings.log found
					{:else}
						<WarningCircleIcon weight="duotone" size={18} />
						{logValidation.reason ?? 'Select your warnings.log'}
					{/if}
				</div>
			</Form.Group>

			<Form.Group>
				<Label>Company of Heroes installation folder</Label>
				<Form.Description>
					The folder containing <code>RelicCOH.exe</code>, usually inside your Steam library under
					<code>steamapps\common\Company of Heroes Relaunch</code>.
				</Form.Description>
				<FileSelection
					name="pathToInstallation"
					directory
					bind:value={settings.tree.app.companyOfHeroesInstallationPath}
				/>
				<div
					class="flex items-center gap-1 text-sm {dirValidation.valid
						? 'text-green-500'
						: 'text-red-500'}"
				>
					{#if dirValidation.valid}
						<CheckCircleIcon weight="duotone" size={18} />
						Installation found
					{:else}
						<WarningCircleIcon weight="duotone" size={18} />
						{dirValidation.reason ?? 'Select your installation folder'}
					{/if}
				</div>
			</Form.Group>
		</Form.Root>

		<div class="flex items-center gap-4">
			<Button onclick={finish} disabled={!canFinish} loading={isFinishing}>Continue</Button>
			{#if !canFinish}
				<span class="text-secondary-500 text-sm">
					Both paths must be valid before you can continue.
				</span>
			{/if}
		</div>
	</div>
</div>

<Toaster theme="dark" />
