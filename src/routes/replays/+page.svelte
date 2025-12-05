<script lang="ts">
	// import { app } from "$core/app";
	// import { ReplayParser } from "$core/replay-analyzer";
	// import { dirname, join } from "@tauri-apps/api/path";
    // import { readDir, readFile } from '@tauri-apps/plugin-fs'
	// import { onMount } from "svelte";

    // const replayFolder = await join(await dirname(app.settings.companyOfHeroesConfigPath), 'playback');
    // const replays = (await readDir(replayFolder)).filter(file => file.name.endsWith('.rec')).slice(0, 100);

    // onMount(async () => {
    //     try {
    //         console.time("Start loading replays");
    //         for await (const file of replays) {
    //             const path = await join(replayFolder, file.name);
    //             const buffer = await readFile(path);
    //             const replay = new ReplayParser(buffer).parse();
    //         }
    //         console.timeEnd("Start loading replays");
    //     } catch (error) {
    //         console.error("Error loading replays:", error);
    //     }
    // })
</script>
