<script lang="ts">
	import { Toaster as SonnerToaster } from 'svelte-sonner';
	import { toastBase } from '@company-of-heroes/ui/variants';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
</script>

<SonnerToaster
	theme="dark"
	position="bottom-right"
	toastOptions={{
		unstyled: true,
		classes: {
			toast: toastBase,
			title: 'text-sm font-semibold',
			description: 'text-sm text-secondary-300',
			icon: 'shrink-0',
			content: 'min-w-0 flex-1',
			actionButton:
				'border-primary/30 bg-primary/15 text-primary ml-auto cursor-pointer rounded border px-2 py-1 text-xs font-medium',
			cancelButton:
				'border-secondary-700 bg-secondary-800 text-secondary-300 ml-auto cursor-pointer rounded border px-2 py-1 text-xs font-medium',
			closeButton:
				'border-secondary-700 bg-secondary-900 text-secondary-400 hover:text-secondary-100 absolute top-1.5 right-1.5 cursor-pointer rounded border p-0.5'
		}
	}}
>
	{#snippet successIcon()}
		<CheckIcon size={18} weight="bold" class="bg-success/30 rounded-md p-1 text-green-200" />
	{/snippet}
	{#snippet errorIcon()}
		<XIcon size={18} weight="bold" class="bg-destructive/30 rounded-md p-1 text-red-200" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon size={18} weight="bold" class="bg-info/30 rounded-md p-1 text-sky-200" />
	{/snippet}
	{#snippet warningIcon()}
		<WarningIcon size={18} weight="bold" class="bg-warning/30 rounded-md p-1 text-amber-200" />
	{/snippet}
</SonnerToaster>
