<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Chat, createChat, createChatCompose } from './chat.svelte.js';
	import { onMount } from 'svelte';
	import { app } from '$core/app/app.svelte.js';

	type Props = {
		roomId: string;
		chat?: Chat;
	} & HTMLAttributes<HTMLDivElement>;

	let { roomId, chat = $bindable(), children, ...restProps }: Props = $props();

	chat = createChat(roomId);
	chat.join();

	createChatCompose();
</script>

<div {...restProps}>
	{@render children?.()}
</div>
