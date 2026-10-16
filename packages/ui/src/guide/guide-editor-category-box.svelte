<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { GUIDE_CATEGORY_NAME_MAX } from '@company-of-heroes/api/guides';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle
	} from '@company-of-heroes/ui/variants';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { tooltip } from '../attachments';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Input, RadioGroup, Select } from '../ui/input';
	import { useGuideEditor } from './guide-editor.context.svelte';
	import type { GuideCategory } from './types';

	const { t } = useI18n();
	const host = useHost();
	const editor = useGuideEditor();

	const NONE = '';
	let adding = $state(false);
	let newName = $state('');
	let newParent = $state(NONE);
	let creating = $state(false);
	/** Staff: the category being renamed, and its new name. */
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let managing = $state(false);

	const items = $derived([
		{ value: NONE, label: t('No category (draft only)') },
		...editor.categories.flatMap((top) => [
			{ value: top.id, label: top.name },
			...top.children.map((child) => ({ value: child.id, label: `${top.name} › ${child.name}` }))
		])
	]);
	const parentItems = $derived([
		{ value: NONE, label: t('Top level') },
		...editor.categories.map((top) => ({ value: top.id, label: top.name }))
	]);
	const flat = $derived(editor.categories.flatMap((top) => [top, ...top.children]));

	async function add() {
		const name = newName.trim();
		if (!name || creating) {
			return;
		}

		creating = true;
		if (await editor.addCategory(name, newParent || null)) {
			newName = '';
			newParent = NONE;
			adding = false;
		}

		creating = false;
	}

	function startRename(category: GuideCategory) {
		renaming = category.id;
		renameValue = category.name;
	}

	async function rename() {
		if (!renaming || !renameValue.trim()) {
			return;
		}

		if (await editor.renameCategory(renaming, renameValue.trim())) {
			renaming = null;
		}
	}
</script>

<section>
	<div class={flushHeader}>
		<h2 class={flushHeaderTitle}>{t('Category')}</h2>
		<p class={flushHeaderDescription}>
			{t('Where the guide sits in the menu, two levels deep at most (Wehrmacht › 1v1).')}
		</p>
	</div>
	<div class="flex flex-col gap-3 px-4 py-3">
		<RadioGroup
			{items}
			value={editor.categoryId ?? NONE}
			onValueChange={(value) => {
				editor.categoryId = value || null;
			}}
			disabled={editor.saving}
			aria-label={t('Category')}
		/>
		{#if adding}
			<form
				class="border-secondary-800 flex flex-col gap-2 border-t pt-3"
				onsubmit={(event) => {
					event.preventDefault();
					void add();
				}}
			>
				<Input
					size="sm"
					bind:value={newName}
					maxlength={GUIDE_CATEGORY_NAME_MAX}
					placeholder={t('Category name')}
					aria-label={t('Category name')}
					disabled={creating}
					required
				/>
				<Select
					type="single"
					size="sm"
					items={parentItems}
					bind:value={newParent}
					disabled={creating}
					aria-label={t('Parent category')}
				/>
				<div class="flex justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={creating}
						onclick={() => {
							adding = false;
						}}
					>
						{t('Cancel')}
					</Button>
					<Button type="submit" size="sm" loading={creating}>{t('Add category')}</Button>
				</div>
			</form>
		{:else if host.auth.user?.canPublish}
			<div class="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="secondary"
					size="sm"
					disabled={editor.saving}
					onclick={() => {
						adding = true;
					}}
				>
					<PlusIcon size={14} />
					{t('Add category')}
				</Button>
				{#if host.auth.user?.isStaff && flat.length}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={() => {
							managing = !managing;
						}}
					>
						<PencilSimpleIcon size={14} />
						{managing ? t('Done') : t('Manage')}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
	{#if managing && host.auth.user?.isStaff}
		<!-- Staff: rename or delete; every row closes with a line and the list overlaps the box's. -->
		<ul class="border-secondary-800 -mb-px border-t">
			{#each flat as category (category.id)}
				<li
					class={cn(
						'border-secondary-800 flex items-center gap-2 border-b py-1.5 pr-2',
						category.parent ? 'pl-8' : 'pl-4'
					)}
				>
					{#if renaming === category.id}
						<Input
							size="sm"
							class="flex-1"
							bind:value={renameValue}
							maxlength={GUIDE_CATEGORY_NAME_MAX}
							aria-label={t('Category name')}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									void rename();
								}

								if (event.key === 'Escape') {
									renaming = null;
								}
							}}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t('Save')}
							{@attach tooltip(t('Save'))}
							onclick={rename}
						>
							<CheckIcon size={14} />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t('Cancel')}
							{@attach tooltip(t('Cancel'))}
							onclick={() => {
								renaming = null;
							}}
						>
							<XIcon size={14} />
						</Button>
					{:else}
						<span class="flex-1 truncate text-sm text-white">{category.name}</span>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t('Rename')}
							{@attach tooltip(t('Rename'))}
							onclick={() => startRename(category)}
						>
							<PencilSimpleIcon size={14} />
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="icon-sm"
							aria-label={t('Delete category')}
							{@attach tooltip(t('Delete category'))}
							onclick={() => editor.deleteCategory(category.id, category.name)}
						>
							<TrashIcon size={14} />
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
