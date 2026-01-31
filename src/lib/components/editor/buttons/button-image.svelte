<script lang="ts">
	import Button from './button.svelte';
	import ImageIcon from 'phosphor-svelte/lib/Image';
	import { app } from '$core/app/context';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { fetch } from '@tauri-apps/plugin-http';
	import { basename, pictureDir } from '@tauri-apps/api/path';
	import { useEditor } from '../context.svelte';
	import { getFileUrl } from '$core/pocketbase';

	const editor = useEditor();
</script>

<Button
	onclick={async () => {
		open({
			defaultPath: await pictureDir(),
			multiple: true,
			filters: [
				{
					name: 'Images',
					extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'svg']
				}
			]
		}).then(async (paths) => {
			if (paths === null) {
				return;
			}

			for await (const path of paths) {
				const file = await readFile(path);
				const filename = await basename(path);

				const attachment = await app.pocketbase.collection('attachments').create(
					{
						type: 'image',
						file: new File([file], filename)
					},
					{ fetch }
				);

				editor.current
					?.chain()
					.focus()
					.setImage({ src: getFileUrl(attachment, attachment.file, { thumb: '300x0' }) })
					.createParagraphNear()
					.run();
			}
		});
	}}
>
	<ImageIcon />
</Button>
