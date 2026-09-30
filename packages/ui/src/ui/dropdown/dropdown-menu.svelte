<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu, type WithoutChildren } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { dropdownPanel } from '../../variants';

	type Props = {
		trigger?: Snippet<[{ props: DropdownMenu.TriggerProps }]>;
		children: Snippet;
		class?: string;
		side?: DropdownMenu.ContentProps['side'];
		align?: DropdownMenu.ContentProps['align'];
		sideOffset?: number;
		alignOffset?: number;
		customAnchor?: DropdownMenu.ContentProps['customAnchor'];
		preventAutoFocus?: boolean;
		trapFocus?: boolean;
		preventScroll?: boolean;
		forceMount?: boolean;
		onInteractOutside?: DropdownMenu.ContentProps['onInteractOutside'];
	} & WithoutChildren<DropdownMenu.RootProps>;

	let {
		trigger,
		children,
		class: className,
		side = 'bottom',
		align = 'start',
		sideOffset = 8,
		alignOffset = 0,
		customAnchor = null,
		preventAutoFocus = false,
		trapFocus = true,
		preventScroll = true,
		forceMount = false,
		onInteractOutside,
		open = $bindable(false),
		...restProps
	}: Props = $props();

	function onOpenAutoFocus(event: Event) {
		if (preventAutoFocus) {
			event.preventDefault();
		}
	}

	function onCloseAutoFocus(event: Event) {
		if (preventAutoFocus) {
			event.preventDefault();
		}
	}
</script>

<DropdownMenu.Root bind:open {...restProps}>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			{#if trigger}
				{@render trigger({ props })}
			{:else}
				<button {...props} type="button" tabindex="-1" class="sr-only" aria-hidden="true"></button>
			{/if}
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			{side}
			{align}
			{sideOffset}
			{customAnchor}
			{onInteractOutside}
			{trapFocus}
			{preventScroll}
			{forceMount}
			{onOpenAutoFocus}
			{onCloseAutoFocus}
			{alignOffset}
			class={cn(
				dropdownPanel,
				'relative z-50',
				'w-[229px]',
				'data-[state=closed]:pointer-events-none data-[state=closed]:hidden',
				className
			)}
		>
			{@render children?.()}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
