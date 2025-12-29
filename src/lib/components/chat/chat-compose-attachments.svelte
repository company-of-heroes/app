<script lang="ts">
	import * as Dropdown from '$lib/components/ui/dropdown';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import ImageIcon from 'phosphor-svelte/lib/Image';
	import FileIcon from 'phosphor-svelte/lib/File';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { basename } from '@tauri-apps/api/path';
	import { app } from '$core/context';
	import { cn } from '$lib/utils';
	import { Button } from '../ui/button';

	type Attachment = {
		type: 'image' | 'file';
		file: File | Blob;
	};

	type Props = {
		attachments: Attachment[];
	};

	let { attachments = $bindable([]) }: Props = $props();
</script>

<Dropdown.Root>
	{#snippet trigger({ props })}
		<Button {...props} variant="ghost" size="icon-sm">
			<PlusIcon size={24} />
		</Button>
	{/snippet}
	<Dropdown.Item
		class="flex items-center gap-2"
		onclick={() => {
			open({
				multiple: true,
				filters: [
					{
						name: 'Images',
						extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
					}
				]
			})
				.then(async (paths) => {
					if (paths && paths.length > 0) {
						for (const path of paths) {
							const file = await readFile(path);
							const filename = await basename(path);
							attachments.push({ type: 'image', file: new File([file], filename) });
						}
					}
				})
				.catch((e) => {
					console.error('Failed to open image:', e);
					app.toast.error('Failed to open image');
				});
		}}
	>
		<ImageIcon size={24} weight="duotone" />
		<span>Add image</span>
	</Dropdown.Item>
	<Dropdown.Item
		class="flex items-center gap-2"
		onclick={() => {
			open({ multiple: true })
				.then(async (paths) => {
					console.log(paths);
					if (paths && paths.length > 0) {
						for (const path of paths) {
							const file = await readFile(path);
							const filename = await basename(path);
							attachments.push({ type: 'file', file: new File([file], filename) });
						}
					}
				})
				.catch((e) => {
					console.error('Failed to open file:', e);
					app.toast.error('Failed to open file');
				});
		}}
	>
		<FileIcon size={24} weight="duotone" />
		<span>Add file</span>
	</Dropdown.Item>
</Dropdown.Root>
