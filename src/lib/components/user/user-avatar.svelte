<script lang="ts">
	import * as Dropdown from '$lib/components/ui/dropdown';
	import { Avatar, type AvatarRootProps, type WithoutChildren } from 'bits-ui';
	import { useUser } from '.';
	import { getFileUrl } from '$core/pocketbase';
	import { createAvatar } from '@dicebear/core';
	import { adventurerNeutral } from '@dicebear/collection';
	import UserIcon from 'phosphor-svelte/lib/User';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';

	type Props = WithoutChildren<AvatarRootProps>;
	let { ...restProps }: Props = $props();

	let user = useUser();
	let avatar = $derived.by(() => {
		if (user.avatar) {
			return getFileUrl(user, user.avatar);
		} else {
			return createAvatar(adventurerNeutral, {
				seed: user.id,
				size: 128
			}).toDataUri();
		}
	});
</script>

<Avatar.Root
	{...restProps}
	class={cn('flex items-center justify-center rounded-full', restProps.class)}
>
	<Dropdown.Root class="w-[150px]">
		{#snippet trigger({ props })}
			<button class="cursor-pointer" {...props}>
				<Avatar.Image src={avatar} alt={`@${user.name}`} class="rounded-full" />
			</button>
		{/snippet}
		<Dropdown.Item
			class="flex items-center gap-2 px-2 py-1 text-sm"
			onclick={() => goto(`/leaderboards/profile/${user.steamIds[0]}`)}
		>
			<UserIcon />
			View Profile
		</Dropdown.Item>
	</Dropdown.Root>
</Avatar.Root>
