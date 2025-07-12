<script lang="ts">
	import type { Twitch } from '$lib/modules/twitch/twitch.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox, Input, RadioGroup } from '$lib/components/ui/input';
	import { app } from '$lib/state/app.svelte';
	import { toast } from 'svelte-sonner';
	import { start, cancel, onUrl } from '@fabianlars/tauri-plugin-oauth';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import Label from '$lib/components/ui/label/label.svelte';
	import TwitchIcon from 'phosphor-svelte/lib/TwitchLogo';
	import { cn } from '$lib/utils';
	import Select from '$lib/components/ui/input/select.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import TwitchTab from './tabs/twitch-tab.svelte';
	import TtsTab from './tabs/tts-tab.svelte';

	const module = app.activeModules.get('twitch') as Twitch;
</script>

<Tabs.Root value="twitch">
	<Tabs.List>
		<Tabs.Trigger value="twitch">Twitch</Tabs.Trigger>
		<Tabs.Trigger value="tts">TTS</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="twitch">
		<TwitchTab />
	</Tabs.Content>
	<Tabs.Content value="tts">
		<TtsTab />
	</Tabs.Content>
</Tabs.Root>
<!-- <form class="max-w-lg">
	<div class="mb-4 flex flex-col gap-2">
		<Label>TTS everything</Label>
		<Checkbox label="Enabled" name="enabled" bind:checked={module.settings.enabled} />
	</div>
	<div class="mb-4 flex flex-col items-start gap-2">
		<Label>Twitch Channel</Label>
		{#if module.isConnected}
			<span class="flex items-center gap-2">
				<Button
					variant="secondary"
					onclick={disconnect}
					type="button"
					class="bg-[#6441a5] shadow-none"
				>
					Disconnect
				</Button>
				<span>-> {module.user?.userName}</span>
			</span>
		{:else}
			<Button
				variant="secondary"
				type="button"
				onclick={startOAuthFlow}
				class="bg-[#6441a5] shadow-none"
			>
				<TwitchIcon size="22" weight="bold" />
				Connect Twitch
			</Button>
		{/if}
	</div>
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
		<div class={cn('bg-primary-100/5 mb-4 p-4')}>
			<div>
				<Label>Tier:</Label>
				{module.elevenlabs?.user?.subscription.tier}
			</div>
			<div>
				<Label>Usage:</Label>
				{module.elevenlabs?.user?.subscription.characterCount} / {module.elevenlabs?.user
					?.subscription.characterLimit}
			</div>
		</div>
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
</form> -->
