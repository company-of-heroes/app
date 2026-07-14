<script lang="ts">
	import Button from './Button.svelte';
	import { latestDownload } from '$lib/download.svelte';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimple';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
</script>

<section id="download" class="border-secondary-800/80 border-t">
	<div class="mx-auto max-w-3xl px-6 py-20 text-center">
		<h2 class="mb-4 text-3xl text-white sm:text-4xl">Ready to play smarter?</h2>
		<p class="text-secondary-300 mb-8 text-lg">
			Download the latest Windows MSI installer from GitHub releases. The app auto-updates with a
			changelog when new versions ship.
		</p>
		<Button href={latestDownload.url} download={latestDownload.fileName} class="text-base">
			<DownloadSimpleIcon size={20} weight="duotone" class="mr-2" />
			Download for Windows
		</Button>

		<div
			class="border-secondary-800 bg-secondary-900/50 mt-10 flex flex-col gap-3 rounded-xl border p-5 text-left"
		>
			<div class="flex items-start gap-3">
				<WarningCircleIcon size={22} weight="duotone" class="text-primary mt-0.5 shrink-0" />
				<div class="text-secondary-300 text-sm leading-relaxed">
					<p class="text-secondary-200 mb-1 font-semibold">Windows SmartScreen notice</p>
					<p>
						The app is not code-signed yet, so Windows may show an “Unknown publisher” warning.
						Download only from the official GitHub releases link above, then choose
						<strong class="text-secondary-100">More info → Run anyway</strong>.
					</p>
				</div>
			</div>
			<p class="text-secondary-500 text-sm">
				From version 1.0 onwards, Company of Heroes - Companion will also be available on the
				Microsoft Store.
			</p>
		</div>
	</div>
</section>
