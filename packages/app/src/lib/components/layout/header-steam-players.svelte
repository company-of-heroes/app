<script lang="ts">
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import { steam } from '$core/steam';
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
	<span class="text-secondary-400 flex items-center gap-1.5 text-sm tabular-nums">
		<UsersIcon size={16} weight="duotone" />
		{t('{count} playing', { count: count.toLocaleString() })}
	</span>
{/if}
