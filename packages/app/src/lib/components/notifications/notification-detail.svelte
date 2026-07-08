<script lang="ts">
	type Props = {
		body: string;
	};

	let { body }: Props = $props();
</script>

<div class="text-secondary-200 whitespace-pre-wrap text-sm leading-relaxed">
	{body}
</div>
