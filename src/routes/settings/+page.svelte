<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$core/app';
	import { documentDir } from '@tauri-apps/api/path';
	import { open } from '@tauri-apps/plugin-dialog';

	const selectWarningsLog = async () => {
		const selectedPath = await open({
			defaultPath: (await documentDir()) + '/My Games/Company of Heroes Relaunch',
			filters: [{ name: 'Log files', extensions: ['log'] }],
			multiple: false
		});

		if (!selectedPath) {
			return;
		}

		app.settings.pathToWarnings = selectedPath;
	};

	$effect(() => {
		console.log(app.currentRoute);
	});
</script>

<form class="max-w-lg">
	<div class="mb-4 flex flex-col gap-2">
		<Label>Path to warnings.log</Label>
		<div class="flex items-center gap-[1px]">
			<Input name="pathToWarnings" bind:value={app.settings.pathToWarnings} />
			<Button variant="secondary" type="button" onclick={selectWarningsLog}>Select file</Button>
		</div>
	</div>
	<div class="mb-4">
		<Button onclick={() => app.store.delete('settings')} variant="secondary" type="button">
			Reset
		</Button>
	</div>
</form>
