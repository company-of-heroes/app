<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { useCompare } from './context';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const context = useCompare();

	const accounts = $derived(context.compare.accounts);
	const selectedCount = $derived(
		accounts.filter((account) => context.selected.includes(account.steamId)).length
	);
	const mine = $derived(
		accounts.find((account) => context.selected.includes(account.steamId)) ?? accounts[0]
	);
	const them = $derived(context.compare.them);
</script>

{#snippet avatar(url: string | null | undefined)}
	{#if url}
		<img
			decoding="async"
			src={host.resolve.avatarUrl(url, { thumb: '100x100' })}
			alt=""
			class="border-secondary-700 size-12 shrink-0 rounded-md border object-cover"
		/>
	{:else}
		<div class="bg-secondary-800 size-12 shrink-0 rounded-md"></div>
	{/if}
{/snippet}

<section class={cn('border-secondary-800 flex items-center gap-4 border-b px-4 py-4', className)}>
	<div class="flex min-w-0 flex-1 items-center gap-3">
		{@render avatar(mine?.avatarUrl)}
		<div class="min-w-0">
			<div class="truncate text-lg font-semibold text-white">{t('You')}</div>
			{#if selectedCount > 1}
				<div class="text-secondary-400 text-sm tabular-nums">
					{t('{count} accounts', { count: selectedCount })}
				</div>
			{/if}
		</div>
	</div>
	<span class="text-secondary-500 shrink-0 text-sm font-bold uppercase">{t('vs')}</span>
	<a
		href={host.routes.player(them.profileId)}
		class={cn(interactive, 'group flex min-w-0 flex-1 items-center justify-end gap-3')}
	>
		<span class="min-w-0 truncate text-lg font-semibold text-white group-hover:underline">
			{them.alias}
		</span>
		{@render avatar(them.avatarUrl)}
	</a>
</section>
