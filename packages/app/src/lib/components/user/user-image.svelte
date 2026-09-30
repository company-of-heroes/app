<script lang="ts">
	import { Avatar } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { userAvatarSrc, type UserAvatarRecord } from './user-avatar-src';

	type Props = {
		user: UserAvatarRecord;
		class?: string;
	};

	let { user, class: className }: Props = $props();
	const src = $derived(userAvatarSrc(user));
	const initial = $derived((user.name ?? '?').slice(0, 1).toUpperCase());
</script>

<Avatar.Root class={cn('size-5 overflow-hidden rounded-full', className)}>
	<Avatar.Image
		{src}
		alt={user.name ? `@${user.name}` : ''}
		class="size-full rounded-full object-cover"
	/>
	<Avatar.Fallback
		class="bg-secondary-800 text-secondary-300 flex size-full items-center justify-center text-[9px] font-semibold"
	>
		{initial}
	</Avatar.Fallback>
</Avatar.Root>
