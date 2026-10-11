<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';

	type Props = {
		/** Custom profile background; without one the header gets a faint primary glow. */
		backgroundUrl?: string | null;
		/** Square avatar block (an image, or a link wrapping one). */
		avatar: Snippet;
		/** Between the avatar and the name (e.g. the like button). */
		beside?: Snippet;
		/** Small row above the name: flag, labels, live state. */
		kicker?: Snippet;
		/** The player name. */
		title: Snippet;
		/** Under the name: links, bio. */
		children?: Snippet;
		/** Buttons on the right, bottom-aligned with the avatar. */
		actions?: Snippet;
		class?: string;
	};

	let {
		backgroundUrl,
		avatar,
		beside,
		kicker,
		title,
		children,
		actions,
		class: className
	}: Props = $props();
</script>

<header class={cn('border-secondary-800 relative isolate overflow-hidden border-b', className)}>
	{#if backgroundUrl}
		<img
			src={backgroundUrl}
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
		/>
		<div
			class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/75 to-gray-950/10"
		></div>
	{:else}
		<div
			class="from-primary/10 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
		></div>
	{/if}
	<div
		class={cn(
			'flex flex-col gap-5 px-4 pb-6 lg:flex-row lg:items-end lg:justify-between',
			backgroundUrl ? 'pt-24 sm:pt-32' : 'pt-6'
		)}
	>
		<div class="flex min-w-0 items-end gap-4 sm:gap-5">
			<div
				class="size-20 shrink-0 overflow-hidden rounded-md bg-gray-950 shadow-lg shadow-black/50 sm:size-28"
			>
				{@render avatar()}
			</div>
			{#if beside}
				<div class="flex shrink-0 self-center">
					{@render beside()}
				</div>
			{/if}
			<div class="flex min-w-0 flex-col gap-2">
				{#if kicker}
					<div class="flex flex-wrap items-center gap-2">
						{@render kicker()}
					</div>
				{/if}
				<h1
					class="font-heading flex min-w-0 items-center gap-2.5 text-3xl leading-tight font-bold text-white drop-shadow-md sm:text-4xl"
				>
					{@render title()}
				</h1>
			</div>
		</div>
		{#if actions}
			<div class="flex shrink-0 flex-wrap items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
	{#if children}
		<div class="-mt-1 flex max-w-3xl flex-col gap-3 px-4 pb-6 empty:hidden">
			{@render children()}
		</div>
	{/if}
</header>
