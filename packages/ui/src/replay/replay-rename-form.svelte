<script lang="ts">
	import { untrack } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { Button } from '../ui/button';
	import { Input } from '../ui/input';
	import * as Form from '../ui/form';

	type Props = {
		initialName: string;
		onSave: (name: string) => void | Promise<void>;
		onCancel: () => void;
	};

	let { initialName, onSave, onCancel }: Props = $props();
	const { t } = useI18n();
	let name = $state(untrack(() => initialName));
	let saving = $state(false);

	async function submit() {
		if (saving) {
			return;
		}

		saving = true;
		try {
			await onSave(name.trim());
		} finally {
			saving = false;
		}
	}
</script>

<Form.Root
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<Form.Group inputId="replay-name" label={t('Replay name')}>
		<Input
			id="replay-name"
			bind:value={name}
			placeholder={t('Replay name')}
			aria-label={t('Replay name')}
			disabled={saving}
			autofocus
		/>
	</Form.Group>
	<Form.Group>
		<Button type="button" variant="secondary" class="w-fit" disabled={saving} onclick={onCancel}>
			{t('Cancel')}
		</Button>
		<Button type="submit" class="w-fit" loading={saving}>{t('Save')}</Button>
	</Form.Group>
</Form.Root>
