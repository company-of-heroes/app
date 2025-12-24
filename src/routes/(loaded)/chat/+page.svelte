<script lang="ts">
	import type { Snapshot } from './$types';
	import * as Chat from '$lib/components/chat';

	let chat = $state<Chat.Context>();

	export const snapshot: Snapshot<Chat.ChatContext> = {
		capture: () => chat!.capture(),
		restore: (data) => chat!.restore(data)
	};
</script>

<Chat.Root class="-mx-8 -my-8 flex h-screen flex-col" roomId="wdqhr1l7wb2byh4" bind:chat>
	<div class="flex grow flex-col-reverse overflow-auto p-6">
		<Chat.Messages />
	</div>
	<div class="bg-secondary-950 border-secondary-800 sticky -bottom-8 mt-auto border-t p-6">
		<Chat.Compose />
	</div>
</Chat.Root>
