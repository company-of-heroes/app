<script lang="ts">
	import { PathSelection } from '@company-of-heroes/ui/input';
	import { open, type DialogFilter } from '@tauri-apps/plugin-dialog';
	import { useI18n } from '$lib/i18n';

	type Props = {
		value?: string;
		directory?: boolean;
		filters?: DialogFilter[];
		defaultPath?: string;
		onSelect?: (path: string) => void;
		class?: string;
	};

	let {
		value = $bindable(),
		directory = false,
		filters,
		defaultPath,
		onSelect,
		class: className
	}: Props = $props();
	const { t } = useI18n();

	async function pick(current: string | undefined) {
		const selected = await open({
			defaultPath: defaultPath ?? current,
			multiple: false,
			directory,
			filters
		});
		return typeof selected === 'string' ? selected : null;
	}
</script>

<PathSelection
	bind:value
	{pick}
	{onSelect}
	class={className}
	placeholder={t('No path selected')}
	selectLabel={t('Select')}
/>
