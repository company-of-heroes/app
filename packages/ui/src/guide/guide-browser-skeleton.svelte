<script lang="ts">
	import { Skeleton } from '../ui/skeleton';
</script>

<div class="divide-secondary-800 -mb-px grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:divide-x">
	<aside class="[&>*]:border-secondary-800 hidden min-w-0 lg:block [&>*]:border-b">
		{#each [1, 2, 3, 4, 5] as row (row)}
			<div class="px-4 py-3">
				<Skeleton class="h-4 w-32" />
			</div>
		{/each}
	</aside>
	<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		<div class="flex flex-col gap-3 px-4 py-6 sm:px-6">
			<Skeleton class="h-9 w-2/3 max-w-xl" />
			<Skeleton class="h-4 w-1/2 max-w-md" />
		</div>
		<div class="flex flex-col gap-3 px-4 py-6 sm:px-6">
			<Skeleton class="h-4 w-full max-w-3xl" />
			<Skeleton class="h-4 w-full max-w-2xl" />
			<Skeleton class="h-64 w-full max-w-3xl" />
		</div>
	</div>
</div>
