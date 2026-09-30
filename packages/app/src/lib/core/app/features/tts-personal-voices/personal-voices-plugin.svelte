<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import UserSoundIcon from 'phosphor-svelte/lib/UserSoundIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { Button } from '$lib/components/ui/button';
	import { dialog } from '$lib/components/ui/dialog';
	import { Checkbox, Input, Selection } from '$lib/components/ui/input';
	import { AddRewardedVoiceUserForm } from '.';
	import { tts } from '$features/twitch';
	import { ttsPersonalVoices } from '$features/tts-personal-voices';
	import SelectVoices from '$lib/components/select/select-voices.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const voiceOptions = $derived(
		tts.provider.voices.map((voice) => ({
			value: voice.voiceId!,
			label: voice.name!,
			disabled: false
		})) ?? []
	);
</script>

<Form.Group
	label={t('Use personal voices rewards')}
	description={t(
		'Enable this option to allow viewers to redeem a custom voice TTS reward using twitch channel points.'
	)}
>
	<Checkbox bind:checked={ttsPersonalVoices.settings.enabled} label={t('Enabled')} />
</Form.Group>

{#if ttsPersonalVoices.enabled}
	<Form.Group
		label={t('Voices')}
		description={t(
			'Select the voices that viewers can choose from when redeeming the personal voice TTS reward.'
		)}
	>
		<Selection
			multiple
			options={voiceOptions}
			placeholder={t('Select voices...')}
			bind:value={ttsPersonalVoices.settings.providers[tts.settings.provider].voices}
		>
			{#snippet icon()}
				<UserSoundIcon />
			{/snippet}
		</Selection>
	</Form.Group>
	<Form.Group label={t('Reward Cost')}>
		<Input
			type="number"
			bind:value={ttsPersonalVoices.settings.cost}
			placeholder={t('Enter reward cost in channel points')}
			step="100"
			min="0"
		/>
	</Form.Group>
	<Form.Group
		label={t('Rewarded Voices')}
		description={Object.keys(ttsPersonalVoices.rewardedVoices).length === 0
			? t(
					'No rewarded voices added yet. Rewarded voices appear here automatically, or add a user below.'
				)
			: undefined}
		layout="stacked"
	>
		{#each Object.entries(ttsPersonalVoices.rewardedVoices) as [user] (user)}
			<div class="flex min-w-0 items-center gap-3">
				<span class="text-primary min-w-0 font-medium">{user}</span>
				<ArrowRightIcon class="text-secondary-500 shrink-0" />
				<Selection
					class="min-w-0 flex-1"
					options={voiceOptions}
					bind:value={ttsPersonalVoices.rewardedVoices[user]}
					placeholder={t('Select voice...')}
				/>
				<Button
					variant="secondary"
					size="icon-sm"
					type="button"
					onclick={() => {
						delete ttsPersonalVoices.rewardedVoices[user];
					}}
				>
					<TrashIcon size={16} />
				</Button>
			</div>
		{/each}
		{#snippet footer()}
			<Button
				variant="secondary"
				class="w-fit"
				type="button"
				onclick={() => {
					dialog.open = true;
					dialog.title = t('Add rewarded user');
					dialog.setComponent(AddRewardedVoiceUserForm);
				}}
			>
				<PlusIcon size={16} />
				{t('Add user')}
			</Button>
		{/snippet}
	</Form.Group>
	<Form.Group
		label={t('Enable free voices')}
		description={t(
			'Enable this option to allow viewers to choose a free voice TTS. This will not use channel points, but uses the !setvoice command to set the voice.'
		)}
	>
		<Checkbox bind:checked={ttsPersonalVoices.settings.enableFreeVoices} label={t('Enabled')} />
	</Form.Group>
	{#if ttsPersonalVoices.settings.enableFreeVoices}
		<Form.Group
			label={t('Free voices')}
			description={t(
				'Select the voices that viewers can choose from when redeeming the free voice TTS reward.'
			)}
		>
			<SelectVoices
				options={tts.provider.voices.map((voice) => {
					return { value: voice.voiceId, label: voice.name };
				})}
				bind:value={ttsPersonalVoices.settings.providers[tts.settings.provider].freeVoices}
				placeholder={t('Select voices...')}
			>
				{#snippet icon()}
					<UserSoundIcon />
				{/snippet}
			</SelectVoices>
		</Form.Group>
		<Form.Group
			label={t('Rewarded free voices')}
			description={Object.keys(ttsPersonalVoices.rewardedFreeVoices).length === 0
				? t(
						'No rewarded free voices added yet. They appear here automatically, or add a user below.'
					)
				: undefined}
			layout="stacked"
		>
			{#each Object.entries(ttsPersonalVoices.rewardedFreeVoices) as [user] (user)}
				<div class="flex min-w-0 items-center gap-3">
					<span class="text-primary min-w-0 font-medium">{user}</span>
					<ArrowRightIcon class="text-secondary-500 shrink-0" />
					<Selection
						class="min-w-0 flex-1"
						options={voiceOptions}
						bind:value={ttsPersonalVoices.rewardedFreeVoices[user]}
						placeholder={t('Select voice...')}
					/>
					<Button
						variant="secondary"
						size="icon-sm"
						type="button"
						onclick={() => {
							delete ttsPersonalVoices.rewardedFreeVoices[user];
						}}
					>
						<TrashIcon size={16} />
					</Button>
				</div>
			{/each}
			{#snippet footer()}
				<Button
					variant="secondary"
					class="w-fit"
					type="button"
					onclick={() => {
						dialog.open = true;
						dialog.title = t('Add rewarded free voice user');
						dialog.setComponent(AddRewardedVoiceUserForm);
					}}
				>
					<PlusIcon size={16} />
					{t('Add user')}
				</Button>
			{/snippet}
		</Form.Group>
	{/if}
{/if}
