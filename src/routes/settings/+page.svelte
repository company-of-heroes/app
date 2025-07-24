<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$core/app';
	import { documentDir } from '@tauri-apps/api/path';
	import { open } from '@tauri-apps/plugin-dialog';

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

<form class="max-w-lg">
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
</form>
