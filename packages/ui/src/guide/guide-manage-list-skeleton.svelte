<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader } from '@company-of-heroes/ui/variants';
	import { Skeleton } from '../ui/skeleton';
</script>

<!-- `GuideManageList`: the header with "New guide", then one row per guide. -->
<div aria-busy="true">
	<div class={cn(flushHeader, 'flex items-center justify-between gap-3')}>
		<Skeleton class="h-3 w-20" />
		<Skeleton class="h-8 w-28 rounded-md" />
	</div>
	<ul class="-mb-px">
		{#each [64, 48, 56, 40, 52] as width (width)}
			<li class="border-secondary-800 flex items-center gap-4 border-b px-4 py-3">
				<div class="flex min-w-0 flex-1 flex-col gap-1.5">
					<Skeleton class="h-5" style="width: {width}%" />
					<Skeleton class="h-3 w-48 max-w-full" />
				</div>
				<Skeleton class="h-6 w-20 shrink-0 rounded-md" />
				<Skeleton class="hidden h-3 w-28 shrink-0 sm:block" />
			</li>
		{/each}
	</ul>
</div>
