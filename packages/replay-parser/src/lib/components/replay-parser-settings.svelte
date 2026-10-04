<script lang="ts">
	import { untrack } from 'svelte';
	import { open } from '@tauri-apps/plugin-dialog';
	import { Button } from '@company-of-heroes/ui/button';
	import { PathSelection } from '@company-of-heroes/ui/input';
	import * as Form from '@company-of-heroes/ui/form';
	import { toast } from '@company-of-heroes/ui/toasts';
	import { useI18n } from '$lib/i18n';
	import type { ReplayLibrary } from '$lib/library/replay-library.svelte';

	type Props = {
		library: ReplayLibrary;
		onDone: () => void;
	};

	let { library, onDone }: Props = $props();
	const { t } = useI18n();

	let playbackDir = $state(untrack(() => library.playbackDir ?? ''));
	let saving = $state(false);

	async function pick(current: string | undefined) {
		const picked = await open({ directory: true, defaultPath: current || undefined });
		return typeof picked === 'string' ? picked : null;
	}

	async function save() {
		saving = true;
		try {
			if (playbackDir && playbackDir !== library.playbackDir) {
				await library.setPlaybackDir(playbackDir);
			}

			toast.success(t('Settings saved.'));
			onDone();
		} finally {
			saving = false;
		}
	}
</script>

<Form.Root
	onsubmit={(event) => {
		event.preventDefault();
		void save();
	}}
>
	<Form.Group label={t('Playback folder')}>
		<PathSelection
			bind:value={playbackDir}
			{pick}
			disabled={saving}
			placeholder={t('No path selected')}
			selectLabel={t('Select')}
		/>
	</Form.Group>
	<Form.Group>
		<Button type="button" variant="secondary" class="w-fit" disabled={saving} onclick={onDone}>
			{t('Cancel')}
		</Button>
		<Button type="submit" class="w-fit" loading={saving}>{t('Save')}</Button>
	</Form.Group>
</Form.Root>
