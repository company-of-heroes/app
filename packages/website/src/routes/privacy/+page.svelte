<script lang="ts">
	import { privacyPolicy, type InlineSpan } from '$lib/site/privacy';
	import { cn } from '$lib/utils/cn';
	import { interactive } from '$lib/utils/variants';
	import { SITE_URL } from '$lib/site/urls';
	import { href, useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const canonical = $derived(`${SITE_URL}${href('/privacy')}`);

	const linkClass = cn(
		interactive,
		'text-primary hover:text-primary-200 underline-offset-2 hover:underline'
	);

	function linkAttrs(href: string) {
		const internal = href.startsWith(SITE_URL) || href.startsWith('mailto:');
		if (internal) return { href, rel: undefined, target: undefined };
		return { href, rel: 'noopener noreferrer', target: '_blank' };
	}
</script>

<svelte:head>
	<title>{t('Privacy Policy')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'How Company of Heroes Companion and coh1stats.com collect, use, and share data — including match stats, player pages, and fair play checks.'
		)}
	/>
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={t('Privacy Policy — Company of Heroes Companion')} />
</svelte:head>

{#snippet inline(spans: InlineSpan[])}
	{#each spans as span, spanIndex (`${span.type}-${spanIndex}-${span.type === 'link' ? span.href : span.text}`)}
		{#if span.type === 'strong'}
			<strong class="font-medium text-white">{span.text}</strong>
		{:else if span.type === 'link'}
			<a {...linkAttrs(span.href)} class={linkClass}>{span.text}</a>
		{:else}
			{span.text}
		{/if}
	{/each}
{/snippet}

<div class="border-secondary-800 border-b">
	<div class="px-4 py-3">
		<p class="text-primary mb-1 text-xs font-medium">{t('Legal')}</p>
		<h1 class="font-heading mb-1 text-xl font-bold text-white">{privacyPolicy.title}</h1>
		{#if privacyPolicy.effectiveDate}
			<p class="text-secondary-400 text-sm">
				{t('Effective date: {date}', { date: privacyPolicy.effectiveDate })}
			</p>
		{/if}
	</div>
</div>

<article class="text-secondary-300 max-w-3xl space-y-4 px-4 py-6 text-sm leading-relaxed">
	{#each privacyPolicy.blocks as block, blockIndex (`${block.type}-${blockIndex}`)}
		{#if block.type === 'h2'}
			<h2 class="font-heading pt-4 text-lg font-bold text-white">{block.text}</h2>
		{:else if block.type === 'h3'}
			<h3 class="pt-2 font-semibold text-white">{block.text}</h3>
		{:else if block.type === 'ul'}
			<ul class="list-disc space-y-1 ps-5">
				{#each block.items as item, itemIndex (`${blockIndex}-${itemIndex}`)}
					<li>{@render inline(item)}</li>
				{/each}
			</ul>
		{:else}
			<p>{@render inline(block.spans)}</p>
		{/if}
	{/each}
</article>
