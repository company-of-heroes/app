<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import UserSoundIcon from 'phosphor-svelte/lib/UserSoundIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { Checkbox, Input, RadioGroup, Selection } from '$lib/components/ui/input';
	import { tts } from '$features/twitch';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const ProviderSettings = $derived(tts.provider.component);
</script>

<Form.Root>
	<Form.Group label={t('Enable TTS')}>
		<Checkbox bind:checked={tts.settings.enabled} label={t('Enabled')} />
	</Form.Group>
	<Form.Group label={t('TTS Provider')}>
		<RadioGroup
			name="provider"
			items={tts.providers.map((provider) => ({
				value: provider.name,
				label: provider.name
			}))}
			direction="horizontal"
			bind:value={tts.settings.provider}
		/>
	</Form.Group>
	<Form.Group label={t('Announce user')}>
		{#snippet description()}
			{t(
				'When enabled, TTS will announce the username of the message sender before reading the message.'
			)}
			<pre>{`{username} says: {message}`}</pre>
		{/snippet}
		<RadioGroup
			name="announceUser"
			items={[
				{
					value: 'always',
					label: t('Always')
				},
				{
					value: 'onlyOnce',
					label: t('Only once')
				}
			]}
			direction="horizontal"
			bind:value={tts.settings.announceUser}
		/>
	</Form.Group>
	<Form.Group label={t('TTS message format')}>
		{#snippet description()}
			{t('Available variables:')} <code>{`{username}`}</code>
			<code>{`{message}`}</code>
		{/snippet}
		<Input
			placeholder={`{username} said, {message}`}
			name="ttsMessageFormat"
			type="text"
			bind:value={tts.settings.messageFormat}
		/>
	</Form.Group>
	<Form.Group
		label={t('Aliases')}
		description={t(
			'Define username → spoken alias mappings. When TTS reads a message it will replace the chat username with the alias (e.g. `sarah123 → Sarah`). Use aliases to correct pronunciations or show full/display names.'
		)}
		layout="stacked"
	>
		{#each tts.settings.aliases as alias, index (alias)}
			<div class="flex min-w-0 items-center gap-3">
				<Input placeholder={t('Username')} type="text" bind:value={alias.username} />
				<Input placeholder={t('Spoken alias')} type="text" bind:value={alias.alias} />
				<Button
					variant="secondary"
					size="icon-sm"
					type="button"
					onclick={() => {
						tts.settings.aliases.splice(index, 1);
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
					tts.settings.aliases.push({ username: '', alias: '' });
				}}
			>
				<PlusIcon size={16} />
				{t('Add alias')}
			</Button>
		{/snippet}
	</Form.Group>
	<Form.Group label={t('Voice character')}>
		<Selection
			bind:value={tts.settings.voiceId}
			options={tts.provider.voices?.map((voice) => {
				return {
					value: voice.voiceId,
					label: voice.name!,
					disabled: false
				};
			})}
			placeholder={t('Select voice')}
			name="voiceName"
		>
			{#snippet icon()}
				<UserSoundIcon />
			{/snippet}
		</Selection>
	</Form.Group>
	<ProviderSettings />
	{#each tts.components as extra (extra.component)}
		{@const Extra = extra.component}
		<Extra {...extra.props} />
	{/each}
</Form.Root>
