<script lang="ts">
	import { Message, useChat } from '.';

	let chat = useChat();
</script>

<div class="flex h-full w-full flex-col items-start justify-end gap-6">
	{#each chat.messages as message}
		<Message {message} />
	{/each}
</div>
