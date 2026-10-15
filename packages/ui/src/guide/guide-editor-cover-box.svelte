<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { GUIDE_COVER_MAX_BYTES } from '@company-of-heroes/api/guides';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle
	} from '@company-of-heroes/ui/variants';
	import { ImageField } from '../ui/image-field';
	import { useGuideEditor } from './guide-editor.context.svelte';

	const { t } = useI18n();
	const editor = useGuideEditor();
</script>

<section>
	<div class={flushHeader}>
		<h2 class={flushHeaderTitle}>{t('Cover image')}</h2>
		<p class={flushHeaderDescription}>
			{t('Shown at the top of the guide and when it is shared. About 1200×630, max 5 MB.')}
		</p>
	</div>
	<div class="px-4 py-3">
		<ImageField
			id="guide-cover"
			shape="cover"
			currentUrl={editor.guide.coverUrl}
			maxBytes={GUIDE_COVER_MAX_BYTES}
			tooBigMessage="The cover must be 5 MB or smaller."
			bind:file={editor.cover}
			bind:clear={editor.clearCover}
			disabled={editor.saving}
		/>
	</div>
</section>
