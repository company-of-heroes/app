<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { useI18n } from '$lib/i18n';

	type Props = {
		/** Reloads when it changes (the slug). */
		key: string;
		/** Null when the page does not exist. */
		load: () => Promise<T | null>;
		children: Snippet<[T]>;
		/** Shown while loading; match the page's own layout. Defaults to a generic block. */
		skeleton?: Snippet;
	};

	let { key, load, children, skeleton }: Props = $props();
	const { t } = useI18n();
	const request = $derived.by(() => {
		void key;
		return load();
	});
</script>

{#await request}
	{#if skeleton}
		{@render skeleton()}
	{:else}
		<div class="flex flex-col gap-3 p-4">
			<Skeleton class="h-9 w-64" />
			<Skeleton class="h-4 w-full max-w-2xl" />
			<Skeleton class="h-64 w-full" />
		</div>
	{/if}
{:then data}
	{#if data}
		{@render children(data)}
	{:else}
		<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
			{t('Not found')}
		</p>
	{/if}
{:catch}
	<p class="text-destructive border-secondary-800 border-b px-4 py-3 text-sm">
		{t('Could not load this page.')}
	</p>
{/await}
