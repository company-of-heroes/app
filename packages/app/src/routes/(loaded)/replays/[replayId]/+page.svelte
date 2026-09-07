<script lang="ts">
	import * as Replay from '$lib/components/replay';
	import * as Match from '$lib/components/match';
	import { page } from '$app/state';
	import { app } from '$core/app/context';
	import { account } from '$core/account';
	import { resource } from 'runed';
	import type { ReplayDetail } from '$core/app/database/replays';
	import { useI18n } from '$lib/i18n';
	import { cn } from '$lib/utils';

	const { t } = useI18n();

	let query = resource(
		() => page.params.replayId!,
		() => app.database.replays.getDetail(page.params.replayId!)
	);

	const canRename = $derived(
		!!query.current?.record &&
			query.current.record.createdBy === account.userId &&
			query.current.record.visibility !== 'member' &&
			query.current.record.visibility !== 'deleted'
	);
	const isMemberRecord = $derived(
		query.current?.record?.visibility === 'member' ||
			query.current?.record?.visibility === 'deleted'
	);
	const showMemberComments = $derived(query.current?.record?.visibility === 'member');
	const highlightCommentId = $derived(page.url.searchParams.get('comment') || undefined);
	const memberReplayId = $derived(query.current?.record?.id ?? page.params.replayId ?? '');

	function onRenamed(payload: { bytes: Uint8Array; title: string }) {
		const current = query.current;
		if (!current) return;

		const next: ReplayDetail = {
			bytes: payload.bytes,
			record: current.record
				? { ...current.record, title: payload.title, file: current.record.file }
				: null
		};
		query.mutate(next);
	}

	async function onMemberUpdated() {
		const id = page.params.replayId;
		if (!id) {
			return;
		}

		try {
			const next = await app.database.replays.getDetail(id);
			query.mutate(next);
		} catch {
			// leave current view
		}
	}
</script>

{#if query.loading}
	<Replay.PageSkeleton />
{:else if query.current}
	{#key query.current.bytes}
		<Replay.Root
			file={query.current.bytes}
			class={cn(isMemberRecord ? 'w-full' : 'border-secondary-900 overflow-clip border-b')}
		>
			<Replay.Title
				crumbLabel={query.current.record?.visibility === 'member' ||
				query.current.record?.visibility === 'deleted'
					? query.current.record.title || null
					: null}
			/>
			<Replay.Details
				{canRename}
				replayId={query.current.record?.id ?? null}
				replayRecord={query.current.record}
				{onRenamed}
				{onMemberUpdated}
			/>
			<Replay.Tabs flush showScreenshots={!isMemberRecord}>
				{#snippet overviewExtra()}
					{#if showMemberComments && memberReplayId}
						<Match.Comments replayId={memberReplayId} {highlightCommentId} />
					{/if}
				{/snippet}
			</Replay.Tabs>
		</Replay.Root>
	{/key}
{:else if query.error}
	<p class="text-secondary-400 px-4 py-3 text-sm">{t('Failed to load replay.')}</p>
{/if}
