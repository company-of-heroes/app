<script lang="ts">
	import { cn } from '$lib/utils';
	import { Avatar } from 'bits-ui';
</script>

<Avatar.Root
	delayMs={200}
	class={cn(
		'border-secondary-600 h-8 w-8 rounded-full border-2',
		'group-hover:border-primary transition-colors duration-200',
		'group-data-[active=true]:border-primary group-data-[active=true]:hover:border-primary'
	)}
>
	<div
		class="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-transparent"
	>
		<Avatar.Image src="/avatar-1.png" alt="@fknoobscoh" />
		<Avatar.Fallback
			class="bg-secondary-950 flex h-full w-full items-center justify-center text-xs font-semibold"
		>
			FK
		</Avatar.Fallback>
	</div>
</Avatar.Root>
