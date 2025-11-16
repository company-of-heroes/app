<script lang="ts">
	import { app } from '$core/app';
	import * as Form from '$lib/components/ui/form';
	import { H } from '$lib/components/ui/h';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
</script>

<H level="4" class="mt-8">Elevenlabs settings</H>
<Form.Group>
	<Label>Elevenlabs API key</Label>
	<Input
		placeholder="Enter elevenlabs API key ..."
		name="elevenlabsApiKey"
		type="password"
		bind:value={app.settings.elevenlabsApiKey}
	/>
</Form.Group>
