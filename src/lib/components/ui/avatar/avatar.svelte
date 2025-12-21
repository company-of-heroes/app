<script lang="ts">
	import { app } from '$core/app';
	import { cn } from '$lib/utils';
	import { Avatar } from 'bits-ui';

	let avatar = $derived(
		app.pocketbase.files.getURL(app.features.auth.user, app.features.auth.user.avatar)
	);
</script>

<Avatar.Root
	delayMs={200}
	class={cn(
		'border-secondary-600 h-10 w-10 rounded-full border-2',
		'group-hover:border-primary transition-colors duration-200',
		'group-data-[active=true]:border-primary group-data-[active=true]:hover:border-primary'
	)}
>
	<div
		class="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-transparent"
	>
		<Avatar.Image src={avatar} alt="@fknoobscoh" />
		<Avatar.Fallback
			class="bg-secondary-950 flex h-full w-full items-center justify-center text-xs font-semibold"
		>
			FK
		</Avatar.Fallback>
	</div>
</Avatar.Root>
