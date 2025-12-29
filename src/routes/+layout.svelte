<script lang="ts">
	import { createApp } from '$core/context';
	import { Modal } from '$lib/components/ui/modal';
	import { Toaster } from 'svelte-sonner';
	import { Dialog } from '$lib/components/ui/dialog';
	import SuccesIcon from 'phosphor-svelte/lib/Check';
	import ErrorIcon from 'phosphor-svelte/lib/ExclamationMark';
	import InfoIcon from 'phosphor-svelte/lib/QuestionMark';

	import '$lib/fonts/TT Mussels/style.css';
	import '@fontsource/nunito-sans/800.css';

	import '../app.css';

	const { data, children } = $props();

	createApp(data.app);
</script>

{@render children()}

<Dialog />
<Modal />

<Toaster
	theme="dark"
	toastOptions={{
		unstyled: true,
		classes: {
			success:
				'gap-2 flex items-center bg-green-950 border-green-800 text-green-100 border rounded-md px-3 py-1.5 shadow-xl text-sm',
			error:
				'gap-2 flex items-center bg-red-950 border-red-800 text-red-100 border rounded-md px-3 py-1.5 shadow-xl text-sm',
			info: 'gap-2 flex items-center bg-gray-900 border-gray-600 text-white border rounded-md px-3 py-1.5 shadow-xl text-sm'
		}
	}}
>
	{#snippet successIcon()}
		<SuccesIcon size={24} class="rounded bg-green-900/50 p-1" />
	{/snippet}
	{#snippet errorIcon()}
		<ErrorIcon size={24} class="rounded bg-red-900/50 p-1" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon size={24} class="rounded bg-gray-950/40 p-1" />
	{/snippet}
</Toaster>
