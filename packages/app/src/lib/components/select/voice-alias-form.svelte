<script lang="ts" module>
	export type VoiceAliasFormProps = {
		alias?: string;
		label: string;
		onSave: (alias: string) => void;
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { dialog } from '$lib/components/ui/dialog';

	let { alias = $bindable(''), label, onSave }: VoiceAliasFormProps = $props();
</script>

<form
	class="space-y-4"
	onsubmit={(event) => {
		event.preventDefault();
		onSave(alias);
	}}
>
	<div class="space-y-2">
		<Label for="voice-alias">Alias</Label>
		<Input id="voice-alias" bind:value={alias} placeholder={label} />
	</div>
	<div class="flex justify-end gap-2">
		<Button type="button" variant="secondary" onclick={() => dialog.close()}>Cancel</Button>
		<Button type="submit" variant="primary">Save</Button>
	</div>
</form>
