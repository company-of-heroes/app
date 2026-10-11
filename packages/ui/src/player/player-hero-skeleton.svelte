<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
</script>

<!-- Same box and closing line as `PlayerHero` without a background. -->
<div class="border-secondary-800 border-b" aria-busy="true">
	<div class="flex flex-col gap-5 px-4 pt-6 pb-6 lg:flex-row lg:items-end lg:justify-between">
		<div class="flex min-w-0 items-end gap-4 sm:gap-5">
			<Skeleton class="size-20 shrink-0 rounded-md sm:size-28" />
			<div class="flex min-w-0 flex-col gap-2">
				<div class="flex items-center gap-2">
					<Skeleton class="h-4 w-6 rounded-xs" />
					<Skeleton class="h-5 w-14 rounded-md" />
				</div>
				<Skeleton class="h-9 w-56 max-w-full" />
			</div>
		</div>
		<div class="flex items-center gap-2">
			<Skeleton class="h-8 w-28 rounded-md" />
			<Skeleton class="h-8 w-32 rounded-md" />
		</div>
	</div>
</div>
