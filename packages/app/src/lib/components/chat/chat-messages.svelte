<script lang="ts">
	import { Message, useChat } from '.';
	import { H } from '../ui/h';
	import PaperPlaneTilt from 'phosphor-svelte/lib/PaperPlaneTilt';

	let chat = useChat();
</script>

<div class="flex h-full w-full flex-col items-start justify-end gap-6">
	{#if chat.messages.length === 0}
		<div class="mx-auto flex max-w-md flex-col items-center py-8 text-center">
			<PaperPlaneTilt size={180} class="text-secondary-900 mb-6" />
			<H level={2} class="text-secondary-500">No messages yet</H>
			<p class="text-secondary-600 mt-2">
				No messages yet — this chat is quieter than a mime convention. Be the brave soul who breaks
				the silence: say hello, drop a meme, or unleash a dramatic GIF and earn eternal bragging
				rights.
			</p>
		</div>
	{/if}
	{#each chat.messages as message}
		<Message {message} />
	{/each}
</div>
