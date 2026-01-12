import { Feature } from '$core/app/features/feature.svelte';
import { watch } from 'runed';
import { invoke } from '@tauri-apps/api/core';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { app } from '$core/app/context';
import { t } from 'try';

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

	enable() {
		app.on('lobby.started', (lobby) => {
			if (!app.game.isWindowFocused || !lobby.me) {
				return;
			}

			this.registerShortcuts(lobby.me.race);
		});

		app.game.on('', () => {
			this.unregisterAllShortcuts();
		});

		watch(
			() => app.game.isWindowFocused,
			(isFocused) => {
				if (!isFocused) {
					this.unregisterAllShortcuts();
				} else {
					if (app.lobby?.me) {
						this.registerShortcuts(app.lobby.me.race);
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
			2: this.settings.factions.allies_commonwealth,
			3: this.settings.factions.axis_panzer_elite
		};

		const shortcutsToRegister = factionMap[race] || [];

		for (const shortcut of shortcutsToRegister) {
			if (shortcut.triggerKeys.length === 0) {
				continue;
			}

			const [, error] = t(
				await register(shortcut.triggerKeys.join('+'), (event) => {
					if (event.state !== 'Pressed') return;
					invoke('send_keys', { keys: shortcut.actionKeys });
				})
			);

			if (error) {
				console.error('Error registering shortcut', error);
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
			// Stop all other recordings first
			for (const [s] of this.handlers) {
				if (s.isRecordingTriggerKeys) this.record(s, 'trigger');
				if (s.isRecordingActionKeys) this.record(s, 'action');
			}

			const stopRecording = () => {
				this.record(keybinding, type);
			};

			const getShortcutKey = (event: KeyboardEvent) => {
				const { key, code } = event;

				if (key === 'CapsLock') return null;
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

				if (!key) return;

				const targetArray = type === 'trigger' ? keybinding.triggerKeys : keybinding.actionKeys;
				if (!targetArray.includes(key)) {
					targetArray.push(key);
				}

				// Reset timeout
				if (entry && entry[type]) {
					clearTimeout(entry[type]!.timeout);
					entry[type]!.timeout = setTimeout(stopRecording, 4000);
				}
			};

			const timeout = setTimeout(stopRecording, 4000);
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
