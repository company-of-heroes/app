<script lang="ts">
	import '../../app.css';

	let { children } = $props();
</script>

<div class="bg-secondary-950 min-h-screen min-w-screen">
	{@render children()}
</div>
