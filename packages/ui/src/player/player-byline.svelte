<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import PlayerLabels from './player-labels.svelte';
	import PlayerStreamerIcon from './player-streamer-icon.svelte';

	type Props = {
		/** An account: avatar, name and, with a Steam ID, its player profile and labels. */
		user: { id: string; name: string; avatarUrl: string | null; steamId: string | null };
		/** `rel` of the profile link (e.g. `author`). */
		rel?: string;
		/** Avatar and name only, without profile link or labels (inside another link). */
		plain?: boolean;
		class?: string;
	};

	let { user, rel, plain = false, class: className }: Props = $props();
	const host = useHost();

	const avatar = $derived(
		host.resolve.userAvatar(
			{ id: user.id, avatarUrl: user.avatarUrl ?? undefined },
			{ thumb: '100x100' }
		)
	);
	const profileHref = $derived(!plain && user.steamId ? host.routes.player(user.steamId) : null);
	const labels = $derived(!plain && user.steamId ? host.api.labels.forSteamId(user.steamId) : []);
</script>

<span class={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
	{#if avatar}
		<img
			src={avatar}
			alt=""
			class={cn('shrink-0 rounded-full object-cover', plain ? 'size-5' : 'size-6')}
			loading="lazy"
		/>
	{/if}
	{#if profileHref}
		<a
			href={profileHref}
			{rel}
			class={cn(interactive, 'hover:text-primary font-medium text-white transition-colors')}
		>
			{user.name}
		</a>
	{:else}
		<span class={cn('font-medium text-white', plain && 'truncate')}>{user.name}</span>
	{/if}
	{#if !plain}
		<PlayerStreamerIcon steamId={user.steamId} />
		<PlayerLabels {labels} />
	{/if}
</span>
