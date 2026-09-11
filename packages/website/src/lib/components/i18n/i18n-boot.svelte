<script lang="ts">
	import {
		createTranslate,
		locales,
		provideI18n,
		type AppI18n,
		type AppLocale
	} from '$lib/i18n';
	import type { Snippet } from 'svelte';

	type Props = {
		locale: AppLocale;
		children: Snippet;
	};

	let { locale, children }: Props = $props();

	// Sync provider — no top-level `await`. Wrapping the header (bits-ui) in an
	// experimental.async suspense boundary triggers Svelte's
	// "Batch has scheduled roots" invariant when dropdown state updates.
	const i18n = {
		get locale() {
			return locale;
		},
		get locales() {
			return [...locales];
		},
		getLocale: () => locale,
		setLocale: () => {
			/* locale is URL-driven on landing */
		},
		get t() {
			return createTranslate(() => locale);
		},
		get _() {
			return createTranslate(() => locale);
		},
		get loading() {
			return { current: false };
		}
	} as AppI18n;

	provideI18n(() => i18n);
</script>

{@render children()}
