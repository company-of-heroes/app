<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Checkbox, Input } from '$lib/components/ui/input';
	import { twitchBot } from '$features/twitch-bot';
	import { Button } from '$lib/components/ui/button';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<Form.Root>
	<Form.Group label={t('Enable bot')}>
		<Checkbox bind:checked={twitchBot.settings.enabled} label={t('Enabled')} />
	</Form.Group>
	{#if twitchBot.enabled}
		<Form.Group
			label={t('Send player stats to chat')}
			description={t(
				'When enabled, the bot posts player card links to your live Twitch and YouTube chat when a match starts.'
			)}
		>
			<Checkbox bind:checked={twitchBot.settings.enablePlayerStats} label={t('Enabled')} />
		</Form.Group>
		<Form.Group
			label={t('Custom bot messages')}
			description={twitchBot.settings.messages.length === 0
				? t('No messages configured yet, create your first message!')
				: undefined}
			layout="stacked"
		>
			{#each twitchBot.settings.messages as message, index (message)}
				<div class="flex min-w-0 items-center gap-3">
					<Input bind:value={message.text} placeholder={t('Enter bot message')} />
					<Input
						type="number"
						bind:value={message.interval}
						min="5"
						placeholder={t('Interval (s)')}
						class="w-24 min-w-24 flex-none"
					/>
					<Button
						variant="secondary"
						size="icon-sm"
						type="button"
						onclick={() => twitchBot.settings.messages.splice(index, 1)}
					>
						<TrashIcon size={16} />
					</Button>
				</div>
			{/each}
			{#snippet footer()}
				<Button
					variant="secondary"
					type="button"
					class="w-fit"
					onclick={() => twitchBot.settings.messages.push({ interval: 5, text: '' })}
				>
					<PlusIcon size={16} />
					{t('Add message')}
				</Button>
			{/snippet}
		</Form.Group>
	{/if}
</Form.Root>
