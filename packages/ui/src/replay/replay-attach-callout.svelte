<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import FileDropzone from '../ui/input/file-dropzone.svelte';
	import { cn } from '../cn';
	import { parseReplayAsync } from './parse/parse-replay-async';
	import type { CommunityMatchDetail } from './types';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import SignInIcon from 'phosphor-svelte/lib/SignInIcon';
	import SpinnerIcon from 'phosphor-svelte/lib/SpinnerIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { escapeHtml, tooltip } from '../attachments';

	type Props = {
		match: CommunityMatchDetail;
	};

	let { match }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let fileName = $state<string | null>(null);
	let busy = $state(false);
	let error = $state('');

	const signedIn = $derived(!!host.auth.user);
	const canAttach = $derived(!!match.canAttachReplay && !!host.api.replays.attach);

	async function attach(file: File | null) {
		if (!file || busy || !host.api.replays.attach) {
			return;
		}

		fileName = file.name;
		error = '';
		busy = true;
		try {
			const { replay } = await parseReplayAsync(await file.arrayBuffer());
			const parsed = replay as unknown as { duration?: number; players?: unknown[] };
			if (!parsed.players?.length) {
				throw new Error(t('Could not parse that replay file.'));
			}

			const result = await host.api.replays.attach(match.id, file, parsed.duration || 0);
			host.notify.success(
				result.keptExisting
					? t('This match already has a longer replay. Thanks anyway!')
					: t('Replay uploaded. Thanks for sharing!')
			);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : t('Could not upload the replay.');
			fileName = null;
		} finally {
			busy = false;
		}
	}
</script>

{#snippet intro()}
	<FilmReelIcon class="text-secondary-500 size-5 shrink-0" weight="duotone" />
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium text-white">{t('Played this match? Upload the replay')}</p>
		<p class="text-secondary-400 truncate text-xs">
			{t('This match has no replay yet. Add your .rec file so everyone can watch and download it.')}
		</p>
	</div>
{/snippet}

{#if canAttach}
	<section class="flex flex-col gap-2 px-4 py-3">
		<div class="flex items-center gap-3">
			{@render intro()}
			<FileDropzone
				id="replay-attach-{match.id}"
				{fileName}
				{busy}
				dropLabel={t('Drop a .rec file here')}
				accept=".rec,application/octet-stream"
				acceptFile={(file) => file.name.toLowerCase().endsWith('.rec')}
				onFileChange={(file) => void attach(file)}
				class="w-auto max-w-48 shrink-0"
				zoneClass={cn(
					'border-secondary-700 bg-secondary-950 text-secondary-200 h-8 min-h-0 flex-row gap-2 px-3 py-0 text-sm font-normal',
					'hover:border-secondary-600 hover:bg-secondary-800 hover:text-white',
					'data-[dragging]:border-primary/60 data-[dragging]:bg-primary/10 data-[dragging]:text-primary data-[dragging]:border-dashed',
					busy && 'opacity-100'
				)}
			>
				{#snippet empty(dragging)}
					<UploadSimpleIcon class="size-4 shrink-0" />
					<span id="replay-attach-{match.id}-hint" class="hidden sm:inline">
						{dragging ? t('Drop a .rec file here') : t('Choose .rec file')}
					</span>
				{/snippet}

				{#snippet selected(name)}
					{#if busy}
						<SpinnerIcon class="text-primary size-4 shrink-0 animate-spin" />
					{:else}
						<CheckCircleIcon class="text-primary size-4 shrink-0" weight="fill" />
					{/if}
					<span
						id="replay-attach-{match.id}-hint"
						class="truncate"
						{@attach tooltip(escapeHtml(name))}>{name}</span
					>
				{/snippet}
			</FileDropzone>
		</div>
		{#if error}
			<p class="text-sm text-red-400" role="alert">{error}</p>
		{/if}
	</section>
{:else if !signedIn}
	<section class="flex items-center gap-3 px-4 py-3">
		{@render intro()}
		<Button href={host.routes.login()} variant="secondary" size="sm" class="shrink-0">
			<SignInIcon class="size-4" />
			<span class="hidden sm:inline">{t('Log in to upload the replay')}</span>
		</Button>
	</section>
{/if}
