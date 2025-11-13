<script lang="ts">
	import { Checkbox, Input, Options } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$core/app';
	import { cn } from '$lib/utils';

	const module = app.getModule('twitch');
</script>

<div class="mb-4 flex flex-col gap-2">
	<Label>Enable predictions</Label>
	<Checkbox
		label="Enabled"
		name="predictionsEnabled"
		bind:checked={module.settings.predictionsEnabled}
	/>
</div>
{#if module.settings.predictionsEnabled}
	<div class={cn('mb-4 flex flex-col gap-2')}>
		<Label>Prediction title</Label>
		<Input
			placeholder="Enter elevenlabs API key ..."
			name="elevenlabsApiKey"
			type="text"
			bind:value={module.settings.predictionsTitle}
		/>
	</div>
	<div class={cn('mb-4 flex flex-col gap-2')}>
		<Label>Prediction timer</Label>
		<Input
			placeholder="Time in seconds"
			name="elevenlabsApiKey"
			type="text"
			class="w-64"
			bind:value={module.settings.predictionsTimer}
		/>
	</div>
	<div class={cn('mb-4 flex flex-col gap-2')}>
		<Label>Prediction options</Label>
		<Options bind:value={module.settings.predictionsOptions} />
	</div>
{/if}
