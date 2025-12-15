import { Feature } from '$core/app/features/feature.svelte';
import { watch } from 'runed';
import { invoke } from '@tauri-apps/api/core';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { app } from '$core/app';

export type Shortcut = {
	description: string;
	triggerKeys: string[];
	actionKeys: string[];
	isRecordingTriggerKeys?: boolean;
	isRecordingActionKeys?: boolean;
};

export type ShortcutSettings = {
	factions: {
		axis: Shortcut[];
		axis_panzer_elite: Shortcut[];
		allies: Shortcut[];
		allies_commonwealth: Shortcut[];
	};
};

export class Shortcuts extends Feature<ShortcutSettings> {
	name = 'shortcuts';

	handlers = new Map<
		Shortcut,
		{
			trigger?: { handler: (e: KeyboardEvent) => void; timeout: ReturnType<typeof setTimeout> };
			action?: { handler: (e: KeyboardEvent) => void; timeout: ReturnType<typeof setTimeout> };
		}
	>();

	enable(): void | this | Promise<void | this> {
		app.game.on('LOBBY:STARTED', (lobby) => {
			if (!app.game.isWindowFocused || !lobby.me) {
				return;
			}

			this.registerShortcuts(lobby.me.race);
		});

		app.game.on('LOBBY:GAMEOVER', () => {
			this.unregisterAllShortcuts();
		});

		watch(
			() => app.game.isWindowFocused,
			(isFocused) => {
				if (!isFocused) {
					this.unregisterAllShortcuts();
				} else {
					if (app.game.lobby?.me) {
						this.registerShortcuts(app.game.lobby.me.race);
					}
				}
			}
		);
	}

	async registerShortcuts(race: number) {
		await this.unregisterAllShortcuts();

		const factionMap: { [key: number]: Shortcut[] } = {
			0: this.settings.factions.allies,
			1: this.settings.factions.axis,
			2: this.settings.factions.axis_panzer_elite,
			3: this.settings.factions.allies_commonwealth
		};

		const shortcutsToRegister = factionMap[race] || [];

		for (const shortcut of shortcutsToRegister) {
			if (shortcut.triggerKeys.length === 0) {
				continue;
			}
			try {
				await register(shortcut.triggerKeys.join('+'), (event) => {
					if (event.state !== 'Pressed') return;
					invoke('send_keys', { keys: shortcut.actionKeys });
				});
			} catch (e) {
				console.error('Error unregistering shortcut', e);
			}
		}
	}

	async unregisterAllShortcuts() {
		return new Promise((resolve) => {
			const unregisterPromises = Object.values(this.settings.factions)
				.flat()
				.map(async (shortcut) => {
					if (
						shortcut.triggerKeys.length === 0 ||
						(await isRegistered(shortcut.triggerKeys.join('+'))) === false
					) {
						return;
					}

					try {
						await unregister(shortcut.triggerKeys.join('+'));
					} catch (e) {
						console.error('Error unregistering shortcut', e);
					}
				});

			Promise.all(unregisterPromises).then(() => resolve(null));
		});
	}

	record(keybinding: Shortcut, type: 'trigger' | 'action') {
		let entry = this.handlers.get(keybinding);
		if (!entry) {
			entry = {};
			this.handlers.set(keybinding, entry);
		}

		const isRecording =
			type === 'trigger' ? keybinding.isRecordingTriggerKeys : keybinding.isRecordingActionKeys;

		if (isRecording) {
			// Stop recording
			const recordEntry = entry[type];
			if (recordEntry) {
				document.removeEventListener('keydown', recordEntry.handler);
				clearTimeout(recordEntry.timeout);
				delete entry[type];
			}

			if (type === 'trigger') {
				keybinding.isRecordingTriggerKeys = false;
			} else {
				keybinding.isRecordingActionKeys = false;
			}
		} else {
			// Start recording
			// First, ensure we aren't recording the other type for this shortcut to avoid confusion
			const otherType = type === 'trigger' ? 'action' : 'trigger';
			if (
				type === 'trigger' ? keybinding.isRecordingActionKeys : keybinding.isRecordingTriggerKeys
			) {
				this.record(keybinding, otherType);
			}

			const stopRecording = () => {
				this.record(keybinding, type);
			};

			const getShortcutKey = (event: KeyboardEvent) => {
				const { key, code } = event;

				if (key === 'Control') return 'CommandOrControl';
				if (key === 'Shift') return 'Shift';
				if (key === 'Alt') return 'Alt';
				if (key === 'Meta') return 'Super';
				if (key === ' ') return 'Space';

				if (code.startsWith('Key')) return code.slice(3);
				if (code.startsWith('Digit')) return code.slice(5);

				const punctuationMap: Record<string, string> = {
					Backquote: '`',
					Minus: '-',
					Equal: '=',
					BracketLeft: '[',
					BracketRight: ']',
					Backslash: '\\',
					Semicolon: ';',
					Quote: "'",
					Comma: ',',
					Period: '.',
					Slash: '/'
				};

				if (code in punctuationMap) return punctuationMap[code];

				return key;
			};

			const handleKeydown = (event: KeyboardEvent) => {
				event.preventDefault();
				const key = getShortcutKey(event);

				const targetArray = type === 'trigger' ? keybinding.triggerKeys : keybinding.actionKeys;
				if (!targetArray.includes(key)) {
					targetArray.push(key);
				}

				// Reset timeout
				if (entry && entry[type]) {
					clearTimeout(entry[type]!.timeout);
					entry[type]!.timeout = setTimeout(stopRecording, 2000);
				}
			};

			const timeout = setTimeout(stopRecording, 2000);
			entry[type] = { handler: handleKeydown, timeout };
			document.addEventListener('keydown', handleKeydown);

			if (type === 'trigger') {
				keybinding.triggerKeys = [];
				keybinding.isRecordingTriggerKeys = true;
			} else {
				keybinding.actionKeys = [];
				keybinding.isRecordingActionKeys = true;
			}
		}
	}

	defaultSettings() {
		return {
			enabled: true,
			factions: {
				axis: [],
				axis_panzer_elite: [],
				allies: [],
				allies_commonwealth: []
			}
		};
	}
}

export const shortcuts = new Shortcuts();
