<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import Button from '$lib/components/ui/button/button.svelte';
	import Trash from 'phosphor-svelte/lib/Trash';
	import UserSoundIcon from 'phosphor-svelte/lib/UserSound';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox, Input, RadioGroup, Selection } from '$lib/components/ui/input';
	import { tts } from '$features/twitch';
</script>

<Form.Root>
	<Form.Group>
		<Label>Enable TTS</Label>
		<Checkbox bind:checked={tts.enabled} label="Enabled" />
	</Form.Group>
	<Form.Group>
		<Label>TTS Provider</Label>
		<div class="flex items-center gap-8">
			<RadioGroup
				name="provider"
				items={tts.providers.map((provider) => ({
					value: provider.name,
					label: provider.name
				}))}
				direction="horizontal"
				bind:value={tts.settings.provider}
			/>
		</div>
	</Form.Group>
	<Form.Group>
		<Label>Announce user</Label>
		<small class="text-secondary-400 -mt-2 mb-1 block">
			When enabled, TTS will announce the username of the message sender before reading the message.
			<pre>{`{username} says: {message}`}</pre>
		</small>
		<RadioGroup
			name="provider"
			items={[
				{
					value: 'always',
					label: 'Always'
				},
				{
					value: 'onlyOnce',
					label: 'Only once'
				}
			]}
			direction="horizontal"
			bind:value={tts.settings.announceUser}
		/>
	</Form.Group>
	<Form.Group>
		<Label>TTS message format</Label>
		<small class="text-secondary-400 -mt-2 mb-1 block">
			Available variables: <code>{`{username}`}</code>
			<code>{`{message}`}</code>
		</small>
		<Input
			placeholder={`{username} said, {message}`}
			name="ttsMessageFormat"
			type="text"
			bind:value={tts.settings.messageFormat}
		/>
	</Form.Group>
	<Form.Group>
		<Label>Aliases</Label>
		<small class="text-secondary-400 -mt-2 mb-1 block">
			Define username → spoken alias mappings. When TTS reads a message it will replace the Twitch
			username with the alias (e.g. `sarah123 → Sarah`). Use aliases to correct pronunciations or
			show full/display names.
		</small>
		<div class="flex flex-col gap-2">
			{#each tts.settings.aliases as alias, index (alias)}
				<div class="flex w-fit gap-2">
					<Input placeholder="Username" type="text" bind:value={alias.username} class="flex-1" />
					<Input placeholder="Spoken alias" type="text" bind:value={alias.alias} class="flex-1" />
					<Button
						variant="destructive"
						class="w-fit px-3 text-white"
						type="button"
						onclick={() => {
							tts.settings.aliases.splice(index, 1);
						}}
					>
						<Trash />
					</Button>
				</div>
			{/each}
		</div>
		<Button
			variant="secondary"
			class="mt-2 w-fit"
			type="button"
			onclick={() => {
				tts.settings.aliases.push({ username: '', alias: '' });
			}}
		>
			Add alias
		</Button>
	</Form.Group>
	<Form.Group>
		<Label>Voice character</Label>
		<Selection
			bind:value={tts.settings.voiceId}
			options={tts.provider.voices?.map((voice) => {
				return {
					value: voice.voiceId,
					label: voice.name!,
					disabled: false
				};
			})}
			placeholder="Select voice"
			name="voiceName"
		>
			{#snippet icon()}
				<UserSoundIcon />
			{/snippet}
		</Selection>
	</Form.Group>

	<!-- Provider specific settings -->
	<svelte:component this={tts.provider.component} />

	<!-- Render additional components registered to the TTS plugin -->
	{#each tts.components as { component, props }}
		<svelte:component this={component} {...props} />
	{/each}
</Form.Root>
