<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { watch } from 'runed';
	import BellIcon from 'phosphor-svelte/lib/BellIcon';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
	import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
	import PackageIcon from 'phosphor-svelte/lib/PackageIcon';
	import ProhibitIcon from 'phosphor-svelte/lib/ProhibitIcon';
	import SealCheckIcon from 'phosphor-svelte/lib/SealCheckIcon';
	import TagSimpleIcon from 'phosphor-svelte/lib/TagSimpleIcon';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import { Label } from '$lib/components/ui/label';
	import * as Nav from '$lib/components/ui/nav';
	import { app } from '$core/app/context';
	import { useI18n } from '$lib/i18n';

	let { children }: { children: Snippet } = $props();

	const { t } = useI18n();

	watch(
		() => app.account.isStaff,
		(isStaff) => {
			if (!isStaff) {
				if (!app.account.isImpersonating) {
					app.toast.error(t('You do not have access to this page.'));
				}

				void goto('/');
			}
		}
	);
</script>

{#if app.account.isStaff}
	<div class="flex min-h-0 flex-1">
		<aside
			class="border-secondary-800 bg-secondary-950/40 flex w-56 shrink-0 flex-col self-stretch border-r"
		>
			<Nav.Root class="gap-6 py-4" aria-label={t('Management')}>
				<div>
					<Label class="text-secondary-300 px-4 font-semibold">{t('Menu')}</Label>
					<Nav.Link href="/admin/notifications" class="gap-2 py-2 text-sm font-semibold">
						<BellIcon size={20} weight="duotone" />
						{t('Notifications')}
					</Nav.Link>
				</div>

				{#if app.account.isAdmin}
					<div>
						<Label class="text-secondary-400 px-4 text-xs font-semibold">{t('Admin')}</Label>
						<Nav.Link href="/admin/users" class="gap-2 py-2 text-sm font-semibold">
							<UsersIcon size={20} weight="duotone" />
							{t('Users')}
						</Nav.Link>
						<Nav.Link href="/admin/labels" class="gap-2 py-2 text-sm font-semibold">
							<TagSimpleIcon size={20} weight="duotone" />
							{t('Labels')}
						</Nav.Link>
						<Nav.Link href="/admin/reputation" class="gap-2 py-2 text-sm font-semibold">
							<SealCheckIcon size={20} weight="duotone" />
							{t('Reputation')}
						</Nav.Link>
					</div>
				{/if}

				<div>
					<Label class="text-secondary-400 px-4 text-xs font-semibold">{t('Fair play')}</Label>
					<Nav.Link href="/admin/flagged" class="gap-2 py-2 text-sm font-semibold">
						<FlagIcon size={20} weight="duotone" />
						{t('Flagged')}
					</Nav.Link>
					<Nav.Link href="/admin/screenshots" class="gap-2 py-2 text-sm font-semibold">
						<ImageIcon size={20} weight="duotone" />
						{t('Screenshots')}
					</Nav.Link>
					<Nav.Link href="/admin/denylist" class="gap-2 py-2 text-sm font-semibold">
						<ProhibitIcon size={20} weight="duotone" />
						{t('Denylist')}
					</Nav.Link>
					<Nav.Link href="/admin/modules" class="gap-2 py-2 text-sm font-semibold">
						<PackageIcon size={20} weight="duotone" />
						{t('Modules')}
					</Nav.Link>
				</div>

				<div>
					<Label class="text-secondary-400 px-4 text-xs font-semibold">{t('Moderation')}</Label>
					<Nav.Link href="/admin/hidden-matches" class="gap-2 py-2 text-sm font-semibold">
						<EyeSlashIcon size={20} weight="duotone" />
						{t('Hidden matches')}
					</Nav.Link>
				</div>
			</Nav.Root>
		</aside>
		<div class="min-w-0 flex-1 overflow-auto">
			{@render children()}
		</div>
	</div>
{/if}
