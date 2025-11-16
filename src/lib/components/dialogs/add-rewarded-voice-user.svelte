<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { app } from '$core/app';
	import { Input, Selection } from '../ui/input';
	import { Label } from '../ui/label';
	import { Button } from '../ui/button';
	import { toast } from 'svelte-sonner';
	import { dialog } from '../ui/dialog';
	import { tts } from '$core/app/twitch';

	let userName = $state('');
	let voiceId = $state('');
</script>

<Form.Root
	onsubmit={(e) => {
		e.preventDefault();

		if (!userName) {
			toast.error('Enter twitch username.');
			return;
		}

		if (!voiceId) {
			toast.error('Select a voice.');
			return;
		}

		app.settings.twitch.tts.personalVoices.rewardedVoices.push({
			user: userName,
			voiceId: voiceId
		});

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
