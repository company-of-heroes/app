<script lang="ts">
	import type { ChatMessageExpanded } from '$core/app/database/chat-rooms';
	import type { AttachmentsResponse } from '$core/pocketbase/types';
	import * as User from '$lib/components/user';
	import { getFileUrl } from '$core/pocketbase';
	import { cn } from '$lib/utils';
	import { AspectRatio } from 'bits-ui';
	import { isEmpty } from 'lodash-es';
	import { marked } from 'marked';
	import { tooltip } from '$lib/attachments';
	import { Button } from '../ui/button';
	import { app } from '$core/app/context';
	import { confirm, save } from '@tauri-apps/plugin-dialog';
	import { useChatCompose } from './chat.svelte';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadSimple';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import dayjs from '$lib/dayjs';

	type Props = {
		message: ChatMessageExpanded;
	};

	let { message }: Props = $props();
	let canModerate = $derived(message.sender.id === app.features.auth.userId);
	let isMessage = $derived(!isEmpty(message.text.trim()));
	let isAttachment = $derived(message.attachments && message.attachments.length > 0 && !isMessage);
	let compose = useChatCompose();
</script>

{#snippet image(attachment: AttachmentsResponse)}
	<img src={getFileUrl(attachment, attachment.file)} alt={attachment.file} class="rounded-lg" />
{/snippet}

{#snippet file(attachment: AttachmentsResponse)}
	<button
		class={cn(
			'grid max-w-min shrink cursor-pointer gap-2 overflow-clip',
			'bg-secondary-950 border-secondary-800 rounded-lg border',
			'hover:bg-secondary-900 transition-colors'
		)}
		onclick={() => save({ title: 'Save attachment', defaultPath: attachment.file })}
		{@attach tooltip(attachment.file)}
	>
		<span class="place-self-center px-12 py-2">
			<DownloadIcon size={54} weight="duotone" class="text-secondary-700" />
		</span>
		<span class="text-secondary-400 border-secondary-800 block truncate border-t px-2 py-1 text-sm">
			{attachment.file}
		</span>
	</button>
{/snippet}

<div class={cn('flex w-full gap-4', canModerate && 'flex-row-reverse')}>
	<div class="w-[55px] self-end">
		<User.Root user={message.sender}>
			<User.Avatar />
		</User.Root>
	</div>
	<div
		class={cn(
			'group relative flex max-w-lg flex-col gap-2',
			canModerate ? 'items-end' : 'items-start'
		)}
	>
		{#if canModerate}
			<div
				class="bg-secondary-800 absolute -top-4 -left-4 inline-flex rounded-lg opacity-0 transition-opacity group-hover:opacity-100"
			>
				{#if isMessage}
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => {
							compose.editMessage(message.id, message.text);
						}}
						{@attach tooltip('Edit message')}
					>
						<PencilSimpleIcon />
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => {
						confirm(
							'Are you sure you want to delete this message? This action cannot be undone.',
							'Delete Message'
						).then((confirmed) => {
							if (confirmed) {
								app.database.chatRooms.deleteMessage(message.id);
							}
						});
					}}
					{@attach tooltip('Delete message')}
				>
					<TrashIcon />
				</Button>
			</div>
		{/if}
		<div class={cn('flex flex-wrap gap-2', canModerate && 'justify-end')}>
			{#each message.attachments as attachment}
				{#if attachment.type === 'image'}
					{@render image(attachment)}
				{/if}
				{#if attachment.type === 'file'}
					{@render file(attachment)}
				{/if}
			{/each}
		</div>
		{#if message.text.trim() !== ''}
			<div
				class={cn(
					'bg-secondary-950 prose prose-invert block rounded-3xl px-6 py-4',
					canModerate ? 'rounded-br-none' : 'rounded-bl-none'
				)}
			>
				{@html marked(message.text)}
			</div>
		{/if}
		<span class="text-secondary-500 text-xs">
			{#if dayjs(message.created).isBefore(message.updated)}
				{dayjs(message.created).format('[edited] [on] ddd D, MMM YYYY [at] hh:mm')}
			{:else}
				{dayjs(message.created).format('ddd D, MMM YYYY [at] hh:mm')}
			{/if}
		</span>
	</div>
</div>
