<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import ReplayFileDropzone from './replay-file-dropzone.svelte';
	import { parseReplayAsync } from './parse/parse-replay-async';
	import type { CommunityMatchDetail } from './types';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import SignInIcon from 'phosphor-svelte/lib/SignInIcon';

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

{#if canAttach || !signedIn}
	<section
		class="border-secondary-800 from-secondary-950 to-secondary-900/80 flex flex-col gap-3 border-b bg-linear-to-r px-4 py-4"
	>
		<div class="flex items-start gap-3">
			<FilmReelIcon class="text-primary mt-0.5 size-6 shrink-0" weight="duotone" />
			<div class="min-w-0">
				<p class="font-medium text-white">{t('Played this match? Upload the replay')}</p>
				<p class="text-secondary-400 mt-0.5 text-sm">
					{t(
						'This match has no replay yet. Add your .rec file so everyone can watch and download it.'
					)}
				</p>
			</div>
		</div>
		{#if canAttach}
			<ReplayFileDropzone
				id="replay-attach-{match.id}"
				{fileName}
				{busy}
				onFileChange={(file) => void attach(file)}
			/>
			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}
		{:else}
			<div>
				<Button href={host.routes.login()} variant="primary" size="sm">
					<SignInIcon class="size-4" />
					{t('Log in to upload the replay')}
				</Button>
			</div>
		{/if}
	</section>
{/if}
