<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { useApp } from '$core/app/context';
	import { watch } from 'runed';
	import { FileSelection } from '../ui/input';
	import { exists } from '@tauri-apps/plugin-fs';

	const app = useApp();

	watch(
		[
			() => app.settings.companyOfHeroesConfigPath,
			() => app.settings.companyOfHeroesInstallationPath
		],
		() => async () => {
			{
				if (
					(await exists(app.settings.companyOfHeroesConfigPath)) &&
					(await exists(app.settings.companyOfHeroesInstallationPath))
				) {
					setTimeout(() => {
						app.toast.success('Company of Heroes configuration paths set successfully!');
						app.modal.close();
					}, 500);
				}
			}
		}
	);
</script>

<Form.Root>
	<Form.Group>
		<Form.Label>Company of Heroes warnings.log path</Form.Label>
		<FileSelection
			bind:value={app.settings.companyOfHeroesConfigPath}
			placeholder="C:\Path\To\Company of Heroes\warnings.log"
			filters={[{ name: 'warnings.log', extensions: ['log'] }]}
			defaultPath={(await app.paths.cohConfigDir()) + '/warnings.log'}
		/>
	</Form.Group>
	<Form.Group>
		<Form.Label>Company of Heroes installation path</Form.Label>
		<FileSelection
			bind:value={app.settings.companyOfHeroesInstallationPath}
			placeholder="C:\Path\To\Company of Heroes\installation"
			filters={[{ name: 'installation', extensions: [''] }]}
			defaultPath={await app.paths.cohInstallationDir()}
			directory={true}
		/>
	</Form.Group>
</Form.Root>
