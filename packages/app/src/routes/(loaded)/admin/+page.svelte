<script lang="ts">
	import { goto } from '$app/navigation';
	import { watch } from 'runed';
	import * as Tabs from '$lib/components/ui/tabs';
	import { H } from '$lib/components/ui/h';
	import { app } from '$core/app/context';
	import NotificationsTab from './tabs/notifications-tab.svelte';

	watch(
		() => app.account.isStaff,
		(isStaff) => {
			if (!isStaff) {
				app.toast.error('Je hebt geen toegang tot deze pagina.');
				void goto('/');
			}
		}
	);
</script>

{#if app.account.isStaff}
	<H level="1">Management</H>

	<Tabs.Root value="notifications" class="mt-8">
		<Tabs.List>
			<Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="notifications">
			<NotificationsTab />
		</Tabs.Content>
	</Tabs.Root>
{/if}
