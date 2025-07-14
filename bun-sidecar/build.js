import { execSync } from 'child_process';
import fs from 'fs';

const ext = process.platform === 'win32' ? '.exe' : '';

const rustInfo = execSync('rustc -vV');
const targetTriple = /host: (\S+)/g.exec(rustInfo)[1];
if (!targetTriple) {
	console.error('Failed to determine platform target triple');
}

fs.renameSync(`fknoobs.exe`, `../src-tauri/binaries/fknoobs-x86_64-pc-windows-msvc.exe`);
console.log(`Renamed fknoobs.exe to fknoobs-x86_64-pc-windows-msvc.exe`);
//fs.renameSync(`fknoobs`, `../src-tauri/binaries/fknoobs-${targetTriple}`);

// if (ext === '.exe') {
// 	fs.renameSync(`fknoobs.exe`, `../src-tauri/binaries/fknoobs-pc-windows-msvc.exe`);
// } else {
// 	fs.renameSync(`fknoobs`, `../src-tauri/binaries/fknoobs-${targetTriple}`);
// }
