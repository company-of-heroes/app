<script lang="ts">
	import { app } from '$core/app';
	import * as Form from '$lib/components/ui/form';
	import { Button } from '../ui/button';
	import { Input } from '../ui/input';
	import { Label } from '../ui/label';
	import { open } from '@tauri-apps/plugin-dialog';
	import { exists } from '@tauri-apps/plugin-fs';
	import { sep, documentDir, dirname } from '@tauri-apps/api/path';
	import { cn } from '$lib/utils';
	import { watch } from 'runed';
	import { Alert } from '../ui/alert';
	import { onMount } from 'svelte';

	let isValidPath = $state(false);
	let pathToWarnings = $derived(app.settings.companyOfHeroesConfigPath + sep() + 'warnings.log');

	async function checkPathAndAutoClose(path: string) {
		try {
			const pathExists = await exists(path);
			isValidPath = pathExists;

			if (pathExists) {
				app.settings.companyOfHeroesConfigPath = await dirname(path);

				setTimeout(() => {
					app.modal.close();
				}, 800);
			}
		} catch {
			isValidPath = false;
		}
	}

	onMount(async () => {
		const dir = await documentDir();
		const defaultPath = `${dir}${sep()}My Games${sep()}Company of Heroes Relaunch${sep()}warnings.log`;

		await checkPathAndAutoClose(defaultPath);
	});

	watch(
		() => pathToWarnings,
		(path) => {
			checkPathAndAutoClose(path);
		},
		{ lazy: true }
	);
</script>

<Form.Root>
	<Form.Group>
		<Label>Company of Heroes path to warnings.log</Label>
		<Form.Description>
			Usually located in {(await documentDir()).replace(/\\/g, '/')}/My Games/Company of Heroes
			Relaunch/warnings.log
		</Form.Description>
		<div class="flex items-center gap-2">
			<Input type="text" value={app.settings.companyOfHeroesConfigPath} class={cn('w-full')} />
			<Button
				variant="secondary"
				onclick={async () => {
					const result = await open({
						title: 'Select folder containing warnings.log',
						multiple: false,
						defaultPath: (await documentDir()) + '/My Games/Company of Heroes Relaunch'
					});

					if (typeof result === 'string') {
						app.settings.companyOfHeroesConfigPath = result;
					}
				}}
			>
				Browse
			</Button>
		</div>
		{#if isValidPath}
			<Alert variant="success">warnings.log found in path.</Alert>
		{:else}
			<Alert variant="warning">warnings.log does not exist in the selected path.</Alert>
		{/if}
	</Form.Group>
</Form.Root>
