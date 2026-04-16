<script lang="ts">
	let { ...restProps } = $props();

	console.log('Toast props:', restProps);
</script>

<div>
	This is a custom component <button onclick={() => dispatchEvent(new CustomEvent('closeToast'))}
		>close</button
	>
</div>
