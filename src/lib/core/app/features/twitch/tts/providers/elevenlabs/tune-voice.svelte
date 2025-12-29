<script lang="ts" module>
	export type TuneVoiceProps = {
		voiceId: string;
	};
</script>

<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Checkbox, Input, Slider } from '$lib/components/ui/input';
	import { app } from '$core/context';
	import { PopoverInfo } from '$lib/components/ui/popover';

	let { voiceId }: TuneVoiceProps = $props();
</script>

<Form.Root>
	<Form.Group>
		<div class="flex items-center gap-2">
			<Form.Label>Stability</Form.Label>
			<PopoverInfo>
				Determines how stable the voice is and the randomness between each generation. Lower values
				introduce broader emotional range for the voice. Higher values can result in a monotonous
				voice with limited emotion.
			</PopoverInfo>
		</div>
		<Slider
			min={0}
			max={1}
			step={0.01}
			bind:value={app.settings.elevenlabsVoiceTunings[voiceId].stability}
		/>
	</Form.Group>
	<Form.Group>
		<div class="flex items-center gap-2">
			<Form.Label>Similarity Boost</Form.Label>
			<PopoverInfo>
				Determines how closely the AI should adhere to the original voice when attempting to
				replicate it.
			</PopoverInfo>
		</div>
		<Slider
			min={0}
			max={1}
			step={0.01}
			bind:value={app.settings.elevenlabsVoiceTunings[voiceId].similarity_boost}
		/>
	</Form.Group>
	<Form.Group>
		<div class="flex items-center gap-2">
			<Form.Label>Style</Form.Label>
			<PopoverInfo>
				Determines the style exaggeration of the voice. This setting attempts to amplify the style
				of the original speaker. It does consume additional computational resources and might
				increase latency if set to anything other than 0.
			</PopoverInfo>
		</div>
		<Slider
			min={0}
			max={1}
			step={0.01}
			bind:value={app.settings.elevenlabsVoiceTunings[voiceId].style}
		/>
	</Form.Group>
	<Form.Group>
		<div class="flex items-center gap-2">
			<Form.Label>Speed</Form.Label>
			<PopoverInfo>
				Adjusts the speed of the voice. A value of 1 is the default speed, while values less than 1
				slow down the speech, and values greater than 1 speed it up.
			</PopoverInfo>
		</div>
		<Slider
			min={0.7}
			max={1.2}
			step={0.01}
			bind:value={app.settings.elevenlabsVoiceTunings[voiceId].speed}
		/>
	</Form.Group>
	<Form.Group>
		<div class="flex items-center gap-2">
			<Form.Label>Use Speaker Boost</Form.Label>
			<PopoverInfo>
				This setting boosts the similarity to the original speaker. Using this setting requires a
				slightly higher computational load, which in turn increases latency.
			</PopoverInfo>
		</div>
		<Checkbox
			label="Use speaker boost"
			bind:checked={app.settings.elevenlabsVoiceTunings[voiceId].use_speaker_boost}
		/>
	</Form.Group>
	<Form.Group>
		<Form.Label>Translate message</Form.Label>
		<Checkbox
			label="Translate message"
			bind:checked={app.settings.elevenlabsVoiceTunings[voiceId].translate}
		/>
	</Form.Group>
	{#if app.settings.elevenlabsVoiceTunings[voiceId].translate}
		<Form.Group>
			<Form.Label>Translate message</Form.Label>
			<Input
				placeholder="Enter target language (e.g., 'en' for English, 'es' for Spanish) ..."
				bind:value={app.settings.elevenlabsVoiceTunings[voiceId].translate_language}
				class="w-fit"
			/>
		</Form.Group>
		<Form.Group>
			<Form.Label>Translate random words</Form.Label>
			<Checkbox
				label="Translate random words"
				bind:checked={app.settings.elevenlabsVoiceTunings[voiceId].translate_random_words}
			/>
		</Form.Group>
	{/if}
</Form.Root>
