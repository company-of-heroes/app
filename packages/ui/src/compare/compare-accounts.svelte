<script lang="ts">
	import type { CompareAccount } from '@company-of-heroes/api/compare';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadText } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { accountName } from './format';
	import { useCompare } from './context';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const context = useCompare();

	const accounts = $derived(context.compare.accounts);

	function isSelected(account: CompareAccount) {
		return context.selected.includes(account.steamId);
	}

	function toggle(account: CompareAccount) {
		const selected = isSelected(account);
		// The last selected account cannot be switched off.
		if (selected && context.selected.length <= 1) {
			return;
		}

		context.onSelect(
			accounts
				.filter((item) =>
					item.steamId === account.steamId ? !selected : context.selected.includes(item.steamId)
				)
				.map((item) => item.steamId)
		);
	}
</script>

{#if accounts.length >= 2}
	<section
		class={cn(
			'border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-3',
			className
		)}
	>
		<span class={cn(tableHeadText, 'mr-1')}>{t('Accounts')}</span>
		{#each accounts as account (account.steamId)}
			{@const selected = isSelected(account)}
			<Button
				type="button"
				variant="secondary"
				size="sm"
				aria-pressed={selected}
				disabled={selected && context.selected.length <= 1}
				class={cn(
					'disabled:opacity-100',
					selected
						? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
						: 'text-secondary-400'
				)}
				onclick={() => toggle(account)}
			>
				{#if account.avatarUrl}
					<img
						decoding="async"
						src={host.resolve.avatarUrl(account.avatarUrl, { thumb: '100x100' })}
						alt=""
						class={cn('size-5 shrink-0 rounded-sm object-cover', !selected && 'opacity-50')}
					/>
				{:else}
					<span class="bg-secondary-800 size-5 shrink-0 rounded-sm"></span>
				{/if}
				<span class="max-w-40 truncate">{accountName(account, account.steamId)}</span>
			</Button>
		{/each}
	</section>
{/if}
