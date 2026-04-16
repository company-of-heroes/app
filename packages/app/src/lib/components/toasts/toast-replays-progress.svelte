<script lang="ts">
	import { app } from '$core/app/context';
	import Spinner from 'phosphor-svelte/lib/Spinner';
</script>

<div
	class="text-secondary-300 flex items-center gap-2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm shadow-xl"
>
	<Spinner class="text-secondary-400 animate-spin" size={20} />
	<span>
		analyzing replays:
		<small class="text-xs">{app.features['replay-analyzer'].progress.processed}</small>
		/
		<small class="text-xs">{app.features['replay-analyzer'].progress.total}</small>
	</span>
</div>
