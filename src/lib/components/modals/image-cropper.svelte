<script lang="ts">
	import Cropper, { type OnCropCompleteEvent } from 'svelte-easy-crop';
	import getCroppedImg from '$lib/utils/canvas';
	import { Button } from '$lib/components/ui/button';
	import { app } from '$core/app';

	type Props = {
		image: string;
		oncrop?: (blob: Blob) => Promise<unknown>;
	};

	let { image, oncrop }: Props = $props();

	let crop = $state({ x: 0, y: 0 });
	let zoom = $state(1);
	let pixelCrop = $state<{ x: number; y: number; width: number; height: number } | null>(null);
	let isSaving = $state(false);

	function handleCropComplete({ pixels }: OnCropCompleteEvent) {
		// Handle both CustomEvent (Svelte 4/legacy) and direct callback (Svelte 5 props)
		pixelCrop = pixels;
	}

	async function save() {
		if (!pixelCrop || !oncrop) return;
		isSaving = true;
		try {
			const croppedBlob = await getCroppedImg(image, pixelCrop);
			if (croppedBlob) {
				await oncrop(croppedBlob);
				app.modal.close();
			}
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div class="relative h-[400px] w-full overflow-hidden rounded-lg bg-gray-800">
		<Cropper {image} bind:crop bind:zoom aspect={1} oncropcomplete={handleCropComplete} />
	</div>
	<div class="flex justify-end gap-2">
		<Button variant="secondary" onclick={() => app.modal.close()}>Cancel</Button>
		<Button onclick={save} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save Avatar'}
		</Button>
	</div>
</div>
