<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { app } from '$lib/state/app.svelte';
	import { cn } from '$lib/utils';
	import { Checkbox, Input, RadioGroup, Select } from '$lib/components/ui/input';
	import { Meter } from '$lib/components/ui/meter';

	const module = app.getModule('twitch');
</script>

<div class="mb-4 flex flex-col gap-2">
	<Label>TTS everything</Label>
	<Checkbox label="Enabled" name="enabled" bind:checked={module.settings.enabled} />
</div>
{#if module.settings.enabled}
	<div class="mb-4 flex flex-col gap-2">
		<Label>TTS Provider</Label>
		<div class="flex items-center gap-8">
			<RadioGroup
				name="provider"
				items={[
					{
						value: 'brian',
						label: 'Brian'
					},
					{
						value: 'elevenlabs',
						label: 'Elevenlabs'
					}
				]}
				direction="horizontal"
				bind:value={module.settings.provider}
			/>
		</div>
	</div>
	<div class={cn(module.settings.provider === 'brian' && 'hidden')}>
		<div class={cn('mb-4 flex flex-col gap-2')}>
			<Label>Elevenlabs API key</Label>
			<Input
				placeholder="Enter elevenlabs API key ..."
				name="elevenlabsApiKey"
				type="text"
				bind:value={module.settings.elevenlabsApiKey}
			/>
		</div>
		{#if module.elevenlabs && module.elevenlabs.user}
			<div class="mb-4">
				<Meter
					label={module.elevenlabs.user.subscription.tier}
					valueLabel={`${module.elevenlabs.user.subscription.characterCount} / ${module.elevenlabs.user.subscription.characterLimit}`}
					max={module.elevenlabs.user.subscription.characterLimit}
					value={module.elevenlabs.user.subscription.characterCount}
				/>
			</div>
		{/if}
		{#if module.elevenlabs}
			<div class={cn('mb-4 flex flex-col gap-2')}>
				<Label>Voice character</Label>
				<Select
					items={module.elevenlabs!.voices.map((voice) => ({
						value: voice.name!,
						label: voice.name!,
						disabled: false
					}))}
					type="single"
					placeholder="Select voice"
					name="voiceName"
					bind:value={module.settings.voiceName}
				/>
			</div>
			<div class="mb-4 flex flex-col gap-2">
				<Label>Enable personal voices?</Label>
				<Checkbox
					label="Enabled"
					name="personalVoicesEnabled"
					bind:checked={module.settings.personalVoicesEnabled}
				/>
			</div>
			<div class={cn(module.settings.personalVoicesEnabled === false && 'hidden')}>
				<div class="mb-4 flex flex-col gap-2">
					<Label>Select voices</Label>
					<Select
						items={module.elevenlabs!.voices.map((voice) => ({
							value: voice.name!,
							label: voice.name!,
							disabled: false
						}))}
						type="multiple"
						placeholder="Select voice"
						name="personalVoices"
						bind:value={module.settings.personalVoices}
					/>
				</div>
			</div>
		{/if}
	</div>
{/if}
