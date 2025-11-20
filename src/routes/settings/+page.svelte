<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { FileSelection, Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$core/app';
	import { dirname, documentDir } from '@tauri-apps/api/path';
	import { open, save } from '@tauri-apps/plugin-dialog';
	import { H } from '$lib/components/ui/h';
	import ImportIcon from 'phosphor-svelte/lib/DownloadSimple';
	import ExportIcon from 'phosphor-svelte/lib/Export';

	const selectConfigDir = async () => {
		const selectedPath = await open({
			defaultPath: (await documentDir()) + '/My Games/Company of Heroes Relaunch',
			multiple: false,
			directory: true
		});

		if (!selectedPath) {
			return;
		}

		app.settings.companyOfHeroesConfigPath = selectedPath;
	};

	$effect(() => {
		console.log(app.route);
	});
</script>

<H level="1">Settings</H>
<Form.Root>
	<Form.Group>
		<Label>Company of Heroes warnings.log</Label>
		<FileSelection name="pathToConfig" bind:value={app.settings.companyOfHeroesConfigPath} />
	</Form.Group>
	<Form.Group>
		<Label>Company of Heroes installation folder</Label>
		<FileSelection
			name="pathToInstallation"
			directory
			bind:value={app.settings.companyOfHeroesInstallationPath}
		/>
	</Form.Group>
	<H level="4">Import / Export</H>
	<Form.Group>
		<Label>Import configuration</Label>
		<Form.Description>
			Import a configuration JSON file to restore your settings. This will overwrite your current
			configuration.
		</Form.Description>
		<Button variant="secondary" type="button" class="w-fit" onclick={() => app.importSettings()}>
			<ImportIcon />
			Import
		</Button>
	</Form.Group>
	<Form.Group>
		<Label>Export configuration</Label>
		<Form.Description>
			Export your current configuration to a JSON file. You can then import it later to restore your
			configuration.
		</Form.Description>
		<Button variant="secondary" type="button" class="w-fit" onclick={() => app.exportSettings()}>
			<ExportIcon />
			Export
		</Button>
	</Form.Group>
</Form.Root>
<!-- <form class="max-w-lg">
	<div class="mb-4 flex flex-col gap-2">
		<Label>Company of Heroes config folder</Label>
		<div class="flex items-center gap-[1px]">
			<Input name="pathToConfig" bind:value={app.settings.companyOfHeroesConfigPath} />
			<Button variant="secondary" type="button" onclick={selectConfigDir}>Select directory</Button>
		</div>
	</div>
	<div class="mb-4">
		<Button onclick={() => app.store.delete('settings')} variant="secondary" type="button">
			Reset
		</Button>
	</div>
</form> -->
