<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		PageSkeleton as ReplayPageSkeleton,
		ReplayDetail as SharedReplayDetail,
		ReplayEditForm
	} from '@company-of-heroes/ui/replay';
	import { resource } from 'runed';
	import { account } from '$core/account';
	import { api } from '$core/api';
	import { app } from '$core/app/context';
	import type { ReplayDetail } from '$core/app/database/replays';
	import * as Replay from '$lib/components/replay';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import { normalizeMapName } from '$lib/utils';

	const { t } = useI18n();

	/** Published (member) replays and lobbies: the shared detail view, same as the website. */
	const shared = resource(
		() => page.params.replayId!,
		async (id) => {
			const result = await api.replays.getAny(id);
			if (result.isOk()) {
				return result.value;
			}

			if (result.error.status === 404) {
				return null;
			}

			throw result.error;
		}
	);

	/** Your own private replays only exist in the desktop app. */
	const privateReplay = resource(
		() => (shared.current === null ? page.params.replayId! : null),
		(id) => (id ? app.database.replays.getDetail(id) : Promise.resolve(null))
	);

	const detail = $derived(shared.current);
	const canEdit = $derived(
		!!detail &&
			detail.kind === 'member' &&
			detail.visibility === 'member' &&
			detail.uploadedBy?.id === account.userId
	);
	const canRename = $derived(
		!!privateReplay.current?.record && privateReplay.current.record.createdBy === account.userId
	);

	function openEdit() {
		if (!detail) {
			return;
		}

		app.modal.create({
			title: t('Edit replay'),
			size: 'lg',
			component: ReplayEditForm,
			props: {
				match: detail,
				onCancel: () => app.modal.close(),
				onDone: () => {
					app.modal.close();
					void shared.refetch();
				},
				onDeleted: () => {
					app.modal.close();
					void goto('/history?tab=member');
				}
			}
		});
		app.modal.open();
	}

	function onRenamed(payload: { bytes: Uint8Array; title: string }) {
		const current = privateReplay.current;
		if (!current) {
			return;
		}

		const next: ReplayDetail = {
			bytes: payload.bytes,
			record: current.record ? { ...current.record, title: payload.title } : null
		};
		privateReplay.mutate(next);
	}
</script>

{#if detail}
	<SetCrumbs
		items={[{ label: (detail.kind === 'member' && detail.title) || normalizeMapName(detail.map) }]}
	/>
	<div class="border-secondary-900 overflow-clip border-b">
		<SharedReplayDetail match={detail} showNav={false}>
			{#snippet actions()}
				{#if canEdit}
					<Button type="button" variant="secondary" onclick={openEdit}>
						{t('Edit')}
					</Button>
				{/if}
			{/snippet}
		</SharedReplayDetail>
	</div>
{:else if privateReplay.current}
	{#key privateReplay.current.bytes}
		<Replay.Root
			file={privateReplay.current.bytes}
			class="border-secondary-900 overflow-clip border-b"
		>
			<Replay.Title />
			<Replay.Details
				{canRename}
				replayId={privateReplay.current.record?.id ?? null}
				replayRecord={privateReplay.current.record}
				{onRenamed}
			/>
			<Replay.Tabs flush />
		</Replay.Root>
	{/key}
{:else if shared.error || privateReplay.error}
	<p class="text-secondary-400 px-4 py-3 text-sm">{t('Failed to load replay.')}</p>
{:else}
	<ReplayPageSkeleton showNav={false} />
{/if}
