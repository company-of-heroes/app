<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { app } from '$lib/state/app.svelte';

	/**
	 * Is not part of the app state, so we just set it here
	 */
	app.currentRoute = {
		title: 'Settings',
		href: '/settings'
	};
</script>

<form class="max-w-lg">
	<div class="mb-4 flex flex-col gap-2">
		<Label>Path to warnings.log</Label>
		<Input name="pathToWarnings" bind:value={app.settings.pathToWarnings} />
	</div>
	<div class="mb-4">
		<Button onclick={() => app.store.delete('settings')} variant="secondary" type="button">
			Reset
		</Button>
	</div>
</form>
