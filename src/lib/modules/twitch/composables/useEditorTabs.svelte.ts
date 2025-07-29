import { type editor as Monaco } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { readTextFile, writeTextFile, type BaseDirectory } from '@tauri-apps/plugin-fs';

export type EditorTab = {
	path: string;
	name: string;
	model: Monaco.ITextModel;
};

export function useEditorTabs(baseDir: BaseDirectory) {
	let openTabs = $state<EditorTab[]>([]);
	let activeTabIndex = $state<number>(-1);
	let editor = $state<Monaco.IStandaloneCodeEditor>();

	const currentFile = $derived(activeTabIndex >= 0 ? openTabs[activeTabIndex] : null);

	const openFile = async (path: string, fileName: string): Promise<void> => {
		// Check if tab is already open
		const existingTabIndex = openTabs.findIndex((tab) => tab.path === path);

		if (existingTabIndex !== -1) {
			// Switch to existing tab
			activeTabIndex = existingTabIndex;
			editor?.setModel(openTabs[existingTabIndex].model);
			return;
		}

		// Read file and create model
		const content = await readTextFile(path, { baseDir });
		const uri = monaco.Uri.file(path);

		let model = monaco.editor.getModel(uri);

		if (!model) {
			model = monaco.editor.createModel(content, undefined, uri);
		} else {
			model.setValue(content);
		}

		// Add new tab
		openTabs.push({
			path,
			name: fileName,
			model
		});

		activeTabIndex = openTabs.length - 1;
		editor?.setModel(model);
	};

	const closeTab = (index: number): void => {
		if (index < 0 || index >= openTabs.length) return;

		// Dispose the model
		openTabs[index].model.dispose();

		// Remove tab
		openTabs.splice(index, 1);

		// Adjust active tab index
		if (activeTabIndex >= index) {
			activeTabIndex = Math.max(0, activeTabIndex - 1);
		}

		// Set model for new active tab or clear editor
		if (openTabs.length > 0 && activeTabIndex < openTabs.length) {
			editor?.setModel(openTabs[activeTabIndex].model);
		} else {
			editor?.setModel(null);
			activeTabIndex = -1;
		}
	};

	const switchTab = (index: number): void => {
		if (index < 0 || index >= openTabs.length) return;
		activeTabIndex = index;
		editor?.setModel(openTabs[index].model);
	};

	const closeTabsForPath = (pathPrefix: string): void => {
		const tabsToClose = [];
		for (let i = openTabs.length - 1; i >= 0; i--) {
			if (openTabs[i].path.startsWith(pathPrefix)) {
				tabsToClose.push(i);
			}
		}
		// Close tabs in reverse order to maintain correct indices
		tabsToClose.forEach((index) => closeTab(index));
	};

	const setupAutoSave = (baseDir: BaseDirectory): void => {
		$effect(() => {
			if (currentFile) {
				currentFile.model.onDidChangeContent(() => {
					writeTextFile(currentFile.path, currentFile.model.getValue(), { baseDir });
				});
			}
		});
	};

	return {
		get openTabs() {
			return openTabs;
		},
		get activeTabIndex() {
			return activeTabIndex;
		},
		currentFile,
		get editor() {
			return editor;
		},
		set editor(value: Monaco.IStandaloneCodeEditor | undefined) {
			editor = value;
		},
		openFile,
		closeTab,
		switchTab,
		closeTabsForPath,
		setupAutoSave
	};
}
