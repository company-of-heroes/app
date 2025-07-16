<script lang="ts">
	import { app } from '$core/app';
	import { ReplayParser } from '$core/replay-analyzer';
	import { readDir } from '@tauri-apps/plugin-fs';
	import { onMount } from 'svelte';

	const pathToReplays = app.settings.companyOfHeroesConfigPath + '/playback';

	onMount(async () => {
		console.time('Loading replays');
		const files = await readDir(pathToReplays);
		const replays = files.filter(
			(file) => file.isFile && file.isSymlink === false && file.name.endsWith('.rec')
		);

		const parsedReplays = await Promise.allSettled(
			replays.map((file) => ReplayParser.parse(`${pathToReplays}/${file.name}`, true))
		);

		const resolvedReplays = parsedReplays
			.filter((result) => result.status === 'fulfilled')
			.map((result) => result.value);
		console.timeEnd('Loading replays');
	});
</script>
