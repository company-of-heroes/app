<script lang="ts">
	import { Toaster as SonnerToaster } from 'svelte-sonner';
	import { toastVariant } from '../variants';
	import SuccesIcon from 'phosphor-svelte/lib/Check';
	import ErrorIcon from 'phosphor-svelte/lib/ExclamationMark';
	import InfoIcon from 'phosphor-svelte/lib/QuestionMark';
</script>

<SonnerToaster
	theme="dark"
	toastOptions={{
		unstyled: true,
		classes: {
			success: toastVariant('success'),
			error: toastVariant('error'),
			info: toastVariant('info')
		}
	}}
>
	{#snippet successIcon()}
		<SuccesIcon size={24} class="rounded bg-success/20 p-1" />
	{/snippet}
	{#snippet errorIcon()}
		<ErrorIcon size={24} class="rounded bg-destructive/20 p-1" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon size={24} class="rounded bg-secondary-950/40 p-1" />
	{/snippet}
</SonnerToaster>
