<script lang="ts">
	import * as monaco from 'monaco-editor';
	import { onMount } from 'svelte';
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
	import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
	import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
	import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
	import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
	import { watch } from 'runed';

	// JSX Highlighter
	import { parse } from '@babel/parser';
	import traverse from '@babel/traverse';
	// @ts-ignore
	import MonacoJSXHighlighter from 'monaco-jsx-highlighter';

	type EditorProps = {
		container?: HTMLDivElement;
		editor?: monaco.editor.IStandaloneCodeEditor;
		value?: string;
		language?: string;
		path?: string;
	};

	let {
		container = $bindable(),
		editor = $bindable(),
		value = $bindable(''),
		language = $bindable(''),
		path = ''
	}: EditorProps = $props();

	function getMonacoLanguage(lang: string) {
		if (lang === 'jsx') return 'javascript';
		if (lang === 'tsx') return 'typescript';
		return lang;
	}

	function getModelUri(lang: string, fallbackPath: string) {
		const ext =
			lang === 'typescript' || lang === 'tsx'
				? 'tsx'
				: lang === 'javascript' || lang === 'jsx'
					? 'jsx'
					: 'txt';
		return monaco.Uri.parse(`file:///${fallbackPath.replace(/\\/g, '/') || 'main.' + ext}`);
	}

	watch(
		() => language,
		() => {
			if (!monaco || !editor || !monaco.editor) {
				return;
			}

			const model = editor.getModel();
			if (model) {
				console.log(language);
				monaco.editor.setModelLanguage(model, getMonacoLanguage(language));
			}
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

		// Define custom theme for JSX tags
		monaco.editor.defineTheme('vs-dark-jsx', {
			base: 'vs-dark',
			inherit: true,
			colors: {},
			rules: [
				{ token: 'identifier.js', foreground: '9CDCFE' },
				{ token: 'type.identifier.js', foreground: '4EC9B0' }
			]
		});

		monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
			jsx: monaco.languages.typescript.JsxEmit.React,
			jsxFactory: 'React.createElement',
			reactNamespace: 'React',
			allowNonTsExtensions: true,
			target: monaco.languages.typescript.ScriptTarget.Latest
		});

		monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
			jsx: monaco.languages.typescript.JsxEmit.React,
			jsxFactory: 'React.createElement',
			reactNamespace: 'React',
			allowNonTsExtensions: true,
			target: monaco.languages.typescript.ScriptTarget.Latest
		});

		const computedLanguage = getMonacoLanguage(language);
		const normalizedPath = path.replace(/\\/g, '/');
		console.log(
			'Mounting editor with language:',
			language,
			'computed:',
			computedLanguage,
			'path:',
			normalizedPath
		);

		const uri = monaco.Uri.parse(
			`file:///${normalizedPath || 'main.' + (language === 'typescript' || language === 'tsx' ? 'tsx' : 'jsx')}`
		);
		let model = monaco.editor.getModel(uri);
		if (!model) {
			model = monaco.editor.createModel(value, computedLanguage, uri);
		} else {
			model.setValue(value);
			monaco.editor.setModelLanguage(model, computedLanguage);
		}

		editor = monaco.editor.create(container, {
			model,
			language: computedLanguage,
			theme: 'vs-dark-jsx',
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

		try {
			// Attach JSX syntax highlighting
			const babelParse = (code: string) =>
				parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

			const highlighter = new MonacoJSXHighlighter(monaco, babelParse, traverse, editor);

			highlighter.highlightOnDidChangeModelContent();
			highlighter.addJSXCommentCommand();
		} catch (error) {
			console.error('Failed to bind JSX highlighter:', error);
		}

		editor?.onDidChangeModelContent(() => {
			value = editor?.getModel()?.getValue() || '';
		});

		return () => {
			editor?.dispose();
		};
	});
</script>

<div bind:this={container} class="w-full grow"></div>
