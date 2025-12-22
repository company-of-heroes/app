<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { Input, Selection, Checkbox } from '$lib/components/ui/input';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import type { MatchList } from './match-list.svelte';

	interface Props {
		list: MatchList;
		mapsList: { value: string; label: string }[];
		playersList: { value: string; label: string }[];
	}

	let { list, mapsList, playersList }: Props = $props();
</script>

<ToggleGroup
	bind:value={list.filters.scope}
	items={[
		{ label: 'My matches', value: 'user' },
		{ label: 'Community matches', value: 'community' }
	]}
	class="mb-8 w-fit"
/>

<Form.Root class="border-secondary-800 mb-4 border-b pb-4">
	<Form.Group>
		<Checkbox
			label="Only ranked games"
			bind:checked={list.filters.ranked.value}
			bind:indeterminate={list.filters.ranked.indeterminate}
		/>
	</Form.Group>

	<Form.Group>
		<Form.Label>Filter players</Form.Label>
		<Selection
			options={playersList}
			placeholder="Select players..."
			multiple
			bind:value={list.filters.players}
		/>
	</Form.Group>

	<div class="grid grid-cols-[250px_1fr] gap-4">
		<Form.Group>
			<Form.Label>Title</Form.Label>
			<Input placeholder="Enter title" bind:value={list.filters.query} />
		</Form.Group>

		<Form.Group>
			<Form.Label>Filter map(s)</Form.Label>
			<Selection
				options={mapsList}
				placeholder="Select maps..."
				multiple
				bind:value={list.filters.maps}
			/>
		</Form.Group>
	</div>
</Form.Root>
