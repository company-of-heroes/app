<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { toast } from 'svelte-sonner';
	import { tts } from '$features/twitch';
	import { ttsPersonalVoices } from '$features/tts-personal-voices';
	import { Label } from '$lib/components/ui/label';
	import { dialog } from '$lib/components/ui/dialog';
	import { Input, Selection } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';

	let userName = $state('');
	let voiceId = $state('');
	let voice = $derived(tts.provider.voices.find((v) => v.voiceId === voiceId));
</script>

<Form.Root
	onsubmit={(e) => {
		e.preventDefault();

		if (!userName) {
			toast.error('Enter twitch username.');
			return;
		}

		if (!voiceId || !voice) {
			toast.error('Select a voice.');
			return;
		}

		ttsPersonalVoices.rewardVoiceToUser(voice, userName);

		userName = '';
		voiceId = '';
		dialog.close();
	}}
>
	<Form.Group>
		<Label>User Name</Label>
		<Input type="text" bind:value={userName} placeholder="Enter the Twitch username" />
	</Form.Group>
	<Form.Group>
		<Label>Select voice</Label>
		<Selection
			options={tts.provider.voices.map((voice) => {
				return {
					value: voice.voiceId!,
					label: voice.name!,
					disabled: false
				};
			}) || []}
			bind:value={voiceId}
			placeholder="Select voice..."
		/>
	</Form.Group>
	<Form.Group class="flex items-end">
		<Button variant="primary" class="w-fit">Add user</Button>
	</Form.Group>
</Form.Root>
