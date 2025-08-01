import { type editor as Monaco } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import {
	exists,
	mkdir,
	readDir,
	readTextFile,
	writeFile,
	rename as rn,
	remove,
	type DirEntry,
	writeTextFile,
	type BaseDirectory
} from '@tauri-apps/plugin-fs';

export type FileEntry = {
	children?: FileEntry[];
	isEditing?: boolean;
	input?: HTMLInputElement;
	oldName?: string;
} & DirEntry;

export type EditorTab = {
	path: string;
	name: string;
	model: Monaco.ITextModel;
};

export function useFileOperations(baseDir: BaseDirectory, basePath: string) {
	// File system operations
	const readDirectory = async (path: string): Promise<DirEntry[]> => {
		return await readDir(path, { baseDir });
	};

	const toggleDirectory = async (path: string, file: FileEntry): Promise<void> => {
		if (file.children) {
			file.children = undefined;
		} else {
			file.children = await readDir(path, { baseDir });
		}
	};

	const renameEntry = async (path: string, file: FileEntry): Promise<void> => {
		if (file.isEditing) {
			await saveRename(path, file);
		} else {
			startRename(file);
		}
		file.isEditing = !file.isEditing;
	};

	const saveRename = async (path: string, file: FileEntry): Promise<void> => {
		const paths = path.split('/');
		paths.pop();

		const oldPath = [...paths, file.oldName ?? file.name].join('/').replace(/\/\//g, '/');
		const newPath = [...paths, file.name].join('/').replace(/\/\//g, '/');

		// Create file/directory if it doesn't exist
		if (!(await exists(oldPath, { baseDir }))) {
			if (file.isDirectory) {
				await mkdir(oldPath, { baseDir });
			} else if (file.isFile) {
				await writeTextFile(oldPath, '', { baseDir });
			}
		}

		// Rename if path changed
		if (oldPath !== newPath) {
			await rn(oldPath, newPath, {
				newPathBaseDir: baseDir,
				oldPathBaseDir: baseDir
			});
		}

		file.oldName = undefined;
	};

	const startRename = (file: FileEntry): void => {
		file.oldName = file.name;
		setTimeout(() => file.input?.focus());
	};

	const deleteEntry = async (path: string): Promise<void> => {
		const fileExists = await exists(path, { baseDir });
		
		if (fileExists) {
			await remove(path, {
				baseDir,
				recursive: true
			});
		}
	};

	const createNewEntry = (name: string, isDirectory: boolean): FileEntry => {
		return {
			name,
			isDirectory,
			isFile: !isDirectory,
			isSymlink: false,
			children: undefined,
			isEditing: true,
			input: undefined,
			oldName: undefined
		};
	};

	return {
		readDirectory,
		toggleDirectory,
		renameEntry,
		deleteEntry,
		createNewEntry
	};
}
