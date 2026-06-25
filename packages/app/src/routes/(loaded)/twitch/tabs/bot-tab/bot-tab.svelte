<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Label } from '$lib/components/ui/label';
	import { H } from '$lib/components/ui/h';
	import { Checkbox, Input } from '$lib/components/ui/input';
	import { twitchBot } from '$features/twitch-bot';
	import { Button } from '$lib/components/ui/button';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
</script>

<Form.Root>
	<H level={4}>Bot settings</H>
	<Form.Group>
		<Label>Enable bot</Label>
		<Checkbox bind:checked={twitchBot.settings.enabled} label="Enabled" />
	</Form.Group>
	{#if twitchBot.enabled}
		<Form.Group>
			<Label>Send player stats to chat</Label>
			<Form.Description>
				When enabled, the bot will send player stats (like rank etc.) to the Twitch chat.
			</Form.Description>
			<Checkbox bind:checked={twitchBot.settings.enablePlayerStats} label="Enabled" />
		</Form.Group>
		<Form.Group>
			<Label>Custom bot messages</Label>
			{#if twitchBot.settings.messages.length === 0}
				<p class="mb-4 text-gray-100">No messages configured yet, create your first message!</p>
			{:else}
				<div class="grid grid-cols-[1fr_8rem_50px] items-center gap-2">
					<Label>Message</Label>
					<Label>Interval (s)</Label>
					<div></div>
				</div>
				{#each twitchBot.settings.messages as message, index}
					<div class="grid grid-cols-[1fr_8rem_50px] items-center gap-2">
						<Input bind:value={message.text} placeholder="Enter bot message" />
						<Input type="number" bind:value={message.interval} min="5" placeholder="Interval (s)" />
						<Button
							variant="destructive"
							onclick={() => twitchBot.settings.messages.splice(index, 1)}
							class="h-full w-full justify-center p-0"
						>
							<TrashIcon />
						</Button>
					</div>
				{/each}
			{/if}
			<Button
				class="w-fit"
				variant="secondary"
				onclick={() => twitchBot.settings.messages.push({ interval: 5, text: '' })}
			>
				<PlusIcon />
				Add message
			</Button>
		</Form.Group>
	{/if}
</Form.Root>
