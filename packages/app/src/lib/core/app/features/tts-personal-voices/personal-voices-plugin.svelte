<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import UserSoundIcon from 'phosphor-svelte/lib/UserSoundIcon';
	import { Button } from '$lib/components/ui/button';
	import { dialog } from '$lib/components/ui/dialog';
	import { H } from '$lib/components/ui/h';
	import { Checkbox, Input, Selection } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { AddRewardedVoiceUserForm } from '.';
	import { tts } from '$features/twitch';
	import { ttsPersonalVoices } from '$features/tts-personal-voices';
	import SelectVoices from '$lib/components/select/select-voices.svelte';
</script>

<H level="4" class="mt-8">Personal voices settings</H>
<Form.Group>
	<Label>Use personal voices rewards</Label>
	<small class="text-secondary-400 -mt-2 mb-1 block">
		Enable this option to allow viewers to redeem a custom voice TTS reward using twitch channel
		points.
	</small>
	<Checkbox bind:checked={ttsPersonalVoices.settings.enabled} label="Enabled" />
</Form.Group>

{#if ttsPersonalVoices.enabled}
	<Form.Group>
		<Label>Voices</Label>
		<small class="text-secondary-400 -mt-2 mb-1 block">
			Select the voices that viewers can choose from when redeeming the personal voice TTS reward.
		</small>
		<Selection
			multiple
			options={tts.provider.voices.map((voice) => {
				return {
					value: voice.voiceId!,
					label: voice.name!,
					disabled: false
				};
			}) || []}
			placeholder="Select voices..."
			bind:value={ttsPersonalVoices.settings.providers[tts.settings.provider].voices}
		>
			{#snippet icon()}
				<UserSoundIcon />
			{/snippet}
		</Selection>
	</Form.Group>
	<Form.Group>
		<Label>Reward Cost</Label>
		<Input
			type="number"
			bind:value={ttsPersonalVoices.settings.cost}
			placeholder="Enter reward cost in channel points"
			class="w-fit"
			step="100"
			min="0"
		/>
	</Form.Group>
	<Form.Group>
		<Label>Rewarded Voices</Label>
		<div class="grid w-fit gap-1">
			{#if Object.keys(ttsPersonalVoices.rewardedVoices).length === 0}
				<p class="text-secondary-400">
					No rewarded voices added yet, rewarded voices will automatically appear here, or add a
					user by clicking the button below.
				</p>
			{/if}
			{#each Object.entries(ttsPersonalVoices.rewardedVoices) as [user, voiceId]}
				<div class="flex items-center gap-2">
					<span class="text-primary font-medium">{user}</span>
					<ArrowRightIcon class="mx-2" />
					<Selection
						options={tts.provider.voices.map((voice) => {
							return {
								value: voice.voiceId,
								label: voice.name
							};
						}) || []}
						bind:value={ttsPersonalVoices.rewardedVoices[user]}
						placeholder="Select voice..."
					/>
					<Button
						variant="secondary"
						class="px-3 py-3"
						type="button"
						onclick={() => {
							delete ttsPersonalVoices.rewardedVoices[user];
						}}
					>
						<TrashIcon />
					</Button>
				</div>
			{/each}
			<Button
				variant="secondary"
				class="mt-4 w-fit"
				type="button"
				onclick={() => {
					dialog.open = true;
					dialog.title = 'Add rewarded user';
					dialog.setComponent(AddRewardedVoiceUserForm);
				}}
			>
				Add user
			</Button>
		</div>
	</Form.Group>
	<Form.Group>
		<Label>Enable free voices</Label>
		<small class="text-secondary-400 -mt-2 mb-1 block">
			Enable this option to allow viewers to choose a free voice TTS. This will not use the channel
			points to redeem the reward, but uses !setvoice command to set the voice.
		</small>
		<Checkbox bind:checked={ttsPersonalVoices.settings.enableFreeVoices} label="Enabled" />
	</Form.Group>
	{#if ttsPersonalVoices.settings.enableFreeVoices}
		<Form.Group>
			<Label>Free voices</Label>
			<small class="text-secondary-400 -mt-2 mb-1 block">
				Select the voices that viewers can choose from when redeeming the free voice TTS reward.
			</small>
			<SelectVoices
				options={tts.provider.voices.map((voice) => {
					return { value: voice.voiceId, label: voice.name };
				})}
				bind:value={ttsPersonalVoices.settings.providers[tts.settings.provider].freeVoices}
				placeholder="Select voices..."
			>
				{#snippet icon()}
					<UserSoundIcon />
				{/snippet}
			</SelectVoices>
		</Form.Group>
		<Form.Group>
			<Label>Rewarded free voices</Label>
			<div class="grid w-fit gap-1">
				{#if Object.keys(ttsPersonalVoices.rewardedFreeVoices).length === 0}
					<p class="text-secondary-400">
						No rewarded free voices added yet, rewarded free voices will automatically appear here,
						or add a user by clicking the button below.
					</p>
				{/if}
				{#each Object.entries(ttsPersonalVoices.rewardedFreeVoices) as [user, voiceId]}
					<div class="flex items-center gap-2">
						<span class="text-primary font-medium">{user}</span>
						<ArrowRightIcon class="mx-2" />
						<Selection
							options={tts.provider.voices.map((voice) => {
								return {
									value: voice.voiceId,
									label: voice.name
								};
							}) || []}
							bind:value={ttsPersonalVoices.rewardedFreeVoices[user]}
							placeholder="Select voice..."
						/>
						<Button
							variant="secondary"
							class="px-3 py-3"
							type="button"
							onclick={() => {
								delete ttsPersonalVoices.rewardedFreeVoices[user];
							}}
						>
							<TrashIcon />
						</Button>
					</div>
				{/each}
				<Button
					variant="secondary"
					class="mt-4 w-fit"
					type="button"
					onclick={() => {
						dialog.open = true;
						dialog.title = 'Add rewarded free voice user';
						dialog.setComponent(AddRewardedVoiceUserForm);
					}}
				>
					Add user
				</Button>
			</div>
		</Form.Group>
	{/if}
{/if}
