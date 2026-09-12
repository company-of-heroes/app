<script lang="ts">
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import { steam } from '$core/steam';
	import { Badge } from '$lib/components/ui/badge';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const REFRESH_MS = 5 * 60 * 1000;

	let count = $state<number | null>(null);

	$effect(() => {
		let cancelled = false;

		async function load() {
			const next = await steam.getCurrentPlayerCount();
			if (cancelled) {
				return;
			}

			count = next;
		}

		load();
		const id = setInterval(load, REFRESH_MS);

		return () => {
			cancelled = true;
			clearInterval(id);
		};
	});
</script>

{#if count !== null}
	<Badge variant="success" class="inline-flex items-center gap-1.5 text-sm tabular-nums">
		<span class="bg-success size-1.5 shrink-0 animate-pulse rounded-full" aria-hidden="true"></span>
		<UsersIcon size={14} weight="duotone" />
		<span class="font-semibold">{t('{count} playing', { count: count.toLocaleString() })}</span>
	</Badge>
{/if}
