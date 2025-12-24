<script lang="ts">
	import { Attachments, useChat, useChatCompose } from '.';
	import { AspectRatio } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import SendIcon from 'phosphor-svelte/lib/PaperPlaneRight';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import ProhibitIcon from 'phosphor-svelte/lib/Prohibit';
	import Spinner from 'phosphor-svelte/lib/Spinner';
	import { Button } from '../ui/button';

	let compose = useChatCompose();
	let chat = useChat();

	const sendMessage = () => {
		compose.error = null;
		compose.isSending = true;

		if (compose.message?.trim() === '' && compose.attachments.length === 0) {
			compose.error = 'Cannot send empty message';
		}

		if (compose.attachments.length > 5) {
			compose.error = 'Cannot send more than 5 attachments';
		}

		if (compose.error) {
			compose.isSending = false;
		}

		if (!compose.error) {
			if (compose.id) {
				if (!compose.message) {
					compose.error = 'MCannot send empty message';
					compose.isSending = false;
					return;
				}

				chat
					.editMessage(compose.id, compose.message)
					.then(() => {
						compose.reset();
					})
					.catch((err) => {
						compose.error = 'Failed to edit message: ' + err.message;
					})
					.finally(() => {
						compose.isSending = false;
					});
			} else {
				chat
					.sendMessage(compose.message, compose.attachments)
					.then(() => {
						compose.reset();
					})
					.catch((err) => {
						compose.error = 'Failed to send message: ' + err.message;
					})
					.finally(() => {
						compose.isSending = false;
					});
			}
		}
	};
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}

		if (e.key === 'Escape' && compose.id) {
			e.preventDefault();
			compose.reset();
		}
	}}
/>

{#if compose.attachments.length}
	<div class="mb-4 flex justify-start gap-6">
		{#each compose.attachments as attachment, index}
			<div class="relative">
				{#if attachment.type === 'image'}
					<div class="size-18">
						<AspectRatio.Root ratio={1}>
							<img
								src={URL.createObjectURL(attachment.file)}
								alt="Attachment"
								class="h-full w-full rounded-md object-cover"
							/>
						</AspectRatio.Root>
					</div>
				{:else if attachment.type === 'file'}
					<div class="flex min-w-16 flex-col">
						<span class="font-medium">File</span>
						<span class="text-secondary-400 text-sm">
							{attachment.file instanceof File ? attachment.file.name : 'Unnamed File'}
						</span>
					</div>
				{/if}
				<button
					class={cn(
						'absolute -top-2 -right-2 rounded p-1.5 shadow-lg',
						'bg-secondary-800 text-destructive cursor-pointer transition-colors',
						'hover:bg-secondary-700'
					)}
					onclick={() => compose.attachments.splice(index, 1)}
					{@attach tooltip('Remove attachment')}
				>
					<TrashIcon size={16} />
				</button>
			</div>
		{/each}
	</div>
{/if}
<div class="bg-secondary-900 flex items-start gap-2 rounded-md p-2">
	<!-- The attachments component -->
	<Attachments bind:attachments={compose.attachments} />

	<!-- The message input area -->
	<textarea
		placeholder="Write your message ..."
		class="field-sizing-content grow resize-none px-2 pt-1 outline-none"
		bind:value={compose.message}
	></textarea>

	<!-- The cancel edit button -->
	<Button
		variant="secondary"
		size="icon-sm"
		onclick={compose.reset}
		hidden={!compose.id}
		{@attach tooltip('Cancel edit')}
	>
		<ProhibitIcon />
	</Button>

	<!-- The send button -->
	<Button
		variant="primary"
		type="button"
		size="icon-sm"
		onclick={sendMessage}
		{@attach tooltip('Send message')}
	>
		{#if compose.isSending}
			<Spinner class="animate-spin" />
		{:else}
			<SendIcon />
		{/if}
	</Button>
</div>
{#if compose.error}
	<p class="text-destructive mt-2 text-sm">{compose.error}</p>
{/if}
