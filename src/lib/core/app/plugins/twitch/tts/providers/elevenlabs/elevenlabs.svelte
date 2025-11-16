<script lang="ts">
	import { ElevenlabsProvider } from './elevenlabs.svelte.js';
	import * as Form from '$lib/components/ui/form';
	import FadersHorizontal from 'phosphor-svelte/lib/FadersHorizontal';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { app } from '$core/app';
	import { Button } from '$lib/components/ui/button';
	import { H } from '$lib/components/ui/h';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { tts } from '$plugins/twitch';
	import { dialog } from '$lib/components/ui/dialog';
	import { AddVoice, TuneVoice } from '.';

	const provider = $derived(tts.provider as ElevenlabsProvider);
</script>

<H level="4" class="mt-8">Elevenlabs settings</H>
<Form.Group>
	<Label>Elevenlabs API key</Label>
	<Input
		placeholder="Enter elevenlabs API key ..."
		name="elevenlabsApiKey"
		type="password"
		bind:value={app.settings.elevenlabsApiKey}
	/>
</Form.Group>
<Form.Group>
	<Label>Custom voices</Label>
	<small class="text-secondary-400 -mt-2 mb-1 block">
		Requires atleast 1 minute of audio playback of the voice for optimal result.
	</small>
	<div class="grid gap-1">
		{#each provider.customVoices as voice (voice.voiceId)}
			<span
				class="bg-secondary-950 border-secondary-700 flex items-center justify-between rounded-md border py-2 ps-4 pe-2"
			>
				<span>{voice.name}</span>
				<span>
					<Button
						variant="secondary"
						class="w-fit px-2"
						onclick={() => {
							dialog.open = true;
							dialog.title = `Tune voice: ${voice.name}`;
							dialog.setComponent(TuneVoice, { voiceId: voice.voiceId });
						}}
					>
						<FadersHorizontal size={18} />
					</Button>
					<Button
						variant="secondary"
						class="w-fit px-2"
						onclick={() => {
							voice.isDeleting = true;
							provider
								.deleteVoice(voice.voiceId)
								.then(() => provider.getVoices())
								.finally(() => {
									voice.isDeleting = false;
								});
						}}
						loading={voice.isDeleting}
					>
						<Trash size={18} />
					</Button>
				</span>
			</span>
		{/each}
	</div>
	<Button
		variant="secondary"
		class="mt-2 w-fit"
		type="button"
		onclick={() => {
			dialog.open = true;
			dialog.title = 'Add custom voice';
			dialog.setComponent(AddVoice);
		}}
	>
		Add voice
	</Button>
</Form.Group>
