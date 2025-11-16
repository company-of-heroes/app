<script lang="ts">
	import * as monaco from 'monaco-editor';
	import { onMount } from 'svelte';
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
	import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
	import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
	import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
	import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
	import { watch } from 'runed';

	type EditorProps = {
		container?: HTMLDivElement;
		editor?: monaco.editor.IStandaloneCodeEditor;
		value?: string;
		language?: string;
	};

	let {
		container = $bindable(),
		editor = $bindable(),
		value = $bindable(''),
		language = $bindable('')
	}: EditorProps = $props();

	watch(
		() => language,
		() => {
			if (!monaco || !editor || !monaco.editor) {
				return;
			}

			monaco.editor.setModelLanguage(editor!.getModel()!, language);
		}
	);

	onMount(() => {
		if (!container) {
			return;
		}

		self.MonacoEnvironment = {
			getWorker: function (_: any, label: string) {
				if (label === 'json') {
					return new jsonWorker();
				}
				if (label === 'css' || label === 'scss' || label === 'less') {
					return new cssWorker();
				}
				if (label === 'html' || label === 'handlebars' || label === 'razor') {
					return new htmlWorker();
				}
				if (label === 'typescript' || label === 'javascript') {
					return new tsWorker();
				}
				return new editorWorker();
			}
		};

		editor = monaco.editor.create(container, {
			value,
			language,
			theme: 'vs-dark',
			minimap: {
				enabled: false
			}
			// Disable features that require workers
			//quickSuggestions: false,
			//parameterHints: { enabled: false },
			//suggestOnTriggerCharacters: false,
			//acceptSuggestionOnEnter: 'off',
			//tabCompletion: 'off',
			//wordBasedSuggestions: 'off'
		});

		editor?.onDidChangeModelContent(() => {
			value = editor?.getModel()?.getValue() || '';
		});

		return () => {
			editor?.dispose();
		};
	});
</script>

<div bind:this={container} class="w-full grow"></div>
