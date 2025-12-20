<script lang="ts">
	import { H } from '$lib/components/ui/h';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { app } from '$core/app';
</script>

<H level={1}>Account</H>

<p class="text-secondary-200 mb-12 max-w-2xl">
	On the installation of the app, a default account is created with a random generated email and
	password. You can use this account to log in and access your data. However, it is recommended to
	create your own account to so other people can identify you on leaderboards and to secure your
	data.
</p>

<H level={3}>Work in progress</H>
<!-- <Form.Root class="mt-6 max-w-md">
	<Form.Group>
		<Form.Label>Email</Form.Label>
		<Input type="email" value={app.features.auth.settings.email} />
	</Form.Group>
	<Form.Group class="mt-4">
		<Form.Label>Password</Form.Label>
		<Input type="password" value={app.features.auth.settings.password} />
	</Form.Group>
</Form.Root> -->
