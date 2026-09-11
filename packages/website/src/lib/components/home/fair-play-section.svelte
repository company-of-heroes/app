<script lang="ts">
	import type { Component } from 'svelte';
	import CameraIcon from 'phosphor-svelte/lib/Camera';
	import CpuIcon from 'phosphor-svelte/lib/Cpu';
	import ChatTextIcon from 'phosphor-svelte/lib/ChatText';
	import { cn } from '$lib/utils/cn';
	import { interactive } from '$lib/utils/variants';
	import { href, useI18n } from '$lib/i18n';

	type Check = {
		id: string;
		title: string;
		description: string;
		icon: Component;
	};

	const checks: Check[] = [
		{
			id: 'screenshots',
			title: 'Match screenshots',
			description:
				'During a match the app uses Company of Heroes\' own Print Screen (never your desktop) and uploads it for review.',
			icon: CameraIcon
		},
		{
			id: 'processes',
			title: 'Cheat-process checks',
			description:
				'Running process names are checked against a denylist. Matches are reported to staff for review.',
			icon: CpuIcon
		},
		{
			id: 'all-chat',
			title: 'All-chat announce',
			description:
				'Optional and off by default. If you turn it on in Settings, the app posts "[FAIRPLAY] Supervised by coh1stats.com" at match start so other players can see fair play is on.',
			icon: ChatTextIcon
		}
	];
	const { t } = useI18n();
</script>

<section id="fair-play" class="border-secondary-800 border-b">
	<div class="border-secondary-800 border-b px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Fair play')}</p>
		<h2 class="font-heading text-xl font-bold text-white">{t('Keep the community clean')}</h2>
		<p class="text-secondary-400 mt-1 text-sm">
			{t(
				'The companion helps catch cheaters so matches stay fair. Screenshot and process checks are on by default; the all-chat announce is off until you turn it on in Settings.'
			)}
		</p>
	</div>
	<div class="grid md:grid-cols-3">
		{#each checks as check, index (check.id)}
			{@const Icon = check.icon}
			<article
				class={cn(
					'border-secondary-800 px-6 py-6',
					index > 0 && 'border-t md:border-t-0 md:border-l'
				)}
			>
				<div class="mb-2 flex items-center gap-2.5">
					<Icon class="text-primary size-5 shrink-0" weight="duotone" />
					<h3 class="font-heading text-base font-bold text-white">{t(check.title)}</h3>
				</div>
				<p class="text-secondary-400 text-sm leading-relaxed">{t(check.description)}</p>
			</article>
		{/each}
	</div>
	<div class="border-secondary-800 border-t px-4 py-3">
		<a
			href={href('/privacy')}
			class={cn(
				interactive,
				'text-secondary-200 text-sm underline underline-offset-2 hover:text-white'
			)}
		>
			{t('How fair play uses data')}
		</a>
	</div>
</section>
