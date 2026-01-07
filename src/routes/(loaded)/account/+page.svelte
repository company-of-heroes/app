<script lang="ts">
	import { H } from '$lib/components/ui/h';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { app } from '$core/context';
	import { fetch } from '@tauri-apps/plugin-http';
	import { AspectRatio } from 'bits-ui';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { open } from '@tauri-apps/plugin-dialog';
	import ImageCropper from '$lib/components/modals/image-cropper.svelte';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { Alert } from '$lib/components/ui/alert';
</script>

<H level={1}>Account</H>

<p class="text-secondary-400 mb-4 max-w-4xl">
	When you install the app, we automatically create a default account for you using a randomly
	generated email address and password. You can use this account right away to sign in and access
	your data. For better security and to be recognizable on leaderboards, we recommend creating your
	own account and switching to it. This makes it easier for others to identify you and helps keep
	your data protected.
</p>

<H level={3} class="mt-4 mb-4">Update Account Settings</H>
<Form.Root class="max-w-md">
	<Form.Group class="max-w-3xs">
		<Form.Label>Avatar</Form.Label>
		<AspectRatio.Root ratio={1 / 1} class="group">
			{#if app.features.auth.avatarUrl}
				<img
					src={app.features.auth.avatarUrl}
					alt="User Avatar"
					class="h-full w-full rounded-md bg-gray-800 object-cover"
				/>
			{:else}
				<div
					class="bg-secondary-950 text-secondary-400 flex h-full w-full items-center justify-center rounded-md"
				>
					No Avatar
				</div>
			{/if}
			<Button
				type="button"
				variant="ghost"
				class={cn(
					'group-flex absolute inset-0 h-full w-full items-center justify-center rounded-md transition-all',
					'bg-secondary-800 text-secondary-200 opacity-0'
				)}
				onclick={async () => {
					const path = await open({
						filters: [
							{
								name: 'Image Files',
								extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
							}
						],
						multiple: false,
						title: 'Select an avatar image'
					});

					if (!path) {
						return;
					}

					const file = await readFile(path);
					const url = URL.createObjectURL(new Blob([file], { type: 'image/*' }));
					app.modal.create({
						title: 'Crop Image',
						component: ImageCropper,
						props: {
							image: url,
							oncrop: async (blob: Blob) => {
								return app.pocketbase
									.collection('users')
									.update(
										app.features.auth.userId,
										{
											avatar: new File([blob], app.features.auth.userId, { type: blob.type })
										},
										{ fetch }
									)
									.then(() => {
										app.features.auth.refreshUser();
									});
							}
						}
					});
					app.modal.open();
				}}
			>
				Select image
			</Button>
		</AspectRatio.Root>
	</Form.Group>
	<Alert variant="warning" class="mb-4">
		These fields are disabled for now, as I am implementing some features.
	</Alert>
	<Form.Group class="mt-4">
		<Form.Label>Displayname</Form.Label>
		<Input type="text" bind:value={app.features.auth.user.name} disabled />
	</Form.Group>
	<Form.Group>
		<Form.Label>Email (Emails are private and will not be shared!)</Form.Label>
		<Input type="email" bind:value={app.features.auth.settings.email} disabled />
		<Form.Description class="mt-1">
			This email is used to sign in to your account. It is recommended to use a valid email address
			so you can recover your account.
		</Form.Description>
	</Form.Group>
	<Form.Group class="mt-4">
		<Form.Label>Password</Form.Label>
		<Input type="password" bind:value={app.features.auth.settings.password} disabled />
	</Form.Group>
</Form.Root>
