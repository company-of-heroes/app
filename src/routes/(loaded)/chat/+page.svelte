<script lang="ts">
	import type { Snapshot } from './$types';
	import * as Chat from '$lib/components/chat';
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { tooltip } from '$lib/attachments';
	import { app } from '$core/context';
	import BellIcon from 'phosphor-svelte/lib/Bell';
	import BellSlashIcon from 'phosphor-svelte/lib/BellSlash';

	let chat = $state<Chat.Context>();

	export const snapshot: Snapshot<Chat.ChatContext> = {
		capture: () => chat!.capture(),
		restore: (data) => chat!.restore(data)
	};

	onDestroy(() => {
		chat?.leave();
	});
</script>

<Chat.Root class="-mx-8 -my-8 flex h-screen flex-col" roomId="wdqhr1l7wb2byh4" bind:chat>
	<Button
		type="button"
		variant="ghost"
		class="absolute top-6 right-6"
		size="icon"
		onclick={() => {
			app.features.chat.settings.muted = !app.features.chat.settings.muted;
		}}
		{@attach tooltip('Mute notifications', { placement: 'left' })}
	>
		{#if app.features.chat.settings.muted}
			<BellSlashIcon size={44} weight="light" class="text-secondary-600" />
		{:else}
			<BellIcon size={44} weight="light" class="text-secondary-600" />
		{/if}
	</Button>
	<div class="flex grow flex-col-reverse overflow-auto p-6">
		<Chat.Messages />
	</div>
	<div class="bg-secondary-950 border-secondary-800 sticky -bottom-8 mt-auto border-t p-6">
		<Chat.Compose />
	</div>
</Chat.Root>
