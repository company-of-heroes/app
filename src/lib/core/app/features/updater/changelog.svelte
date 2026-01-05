<script lang="ts">
	import ChangeLog from '../../../../../../CHANGELOG.md?raw';
	import { marked } from 'marked';
</script>

<div
	class="prose prose-headings:text-white prose-code:text-white prose-blockquote:text-white text-white"
>
	{@html marked(ChangeLog)}
</div>
