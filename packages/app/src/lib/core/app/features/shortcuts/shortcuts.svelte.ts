import { Feature } from '../feature.svelte';
import { watch } from 'runed';
import { invoke } from '@tauri-apps/api/core';
import { register, unregister, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { app } from '$core/app/context';
import { t } from 'try';

const ACTION_MODIFIER_KEYS = new Set([
	'CommandOrControl',
	'CmdOrControl',
	'Ctrl',
	'Control',
	'Shift',
	'Alt',
	'Super',
	'Meta'
]);

export type Shortcut = {
	id: string;
	description: string;
	triggerKeys: string[];
	actionKeys: string[];
	isRecordingTriggerKeys?: boolean;
	isRecordingActionKeys?: boolean;
};

export type FactionKey = keyof ShortcutSettings['factions'];

function createShortcut(partial?: Partial<Shortcut>): Shortcut {
	return {
		id: partial?.id ?? crypto.randomUUID(),
		description: partial?.description ?? 'New Keybinding',
		triggerKeys: partial?.triggerKeys ?? [],
		actionKeys: partial?.actionKeys ?? []
	};
}

function normalizeShortcut(shortcut: Partial<Shortcut>): Shortcut {
	return createShortcut(shortcut);
}

export type ShortcutSettings = {
	factions: {
		axis: Shortcut[];
		axis_panzer_elite: Shortcut[];
		allies: Shortcut[];
		allies_commonwealth: Shortcut[];
	};
};

function actionKeysForSendKeys(keys: string[]): string[] {
	return keys
		.filter((key) => !ACTION_MODIFIER_KEYS.has(key))
		.map((key) => {
			if (key.startsWith('Key')) {
				return key.slice(3).toLowerCase();
			}

			if (key.startsWith('Digit')) {
				return key.slice(5);
			}

			return key.toLowerCase();
		});
}

const HOLD_ACTION_KEYS = new Set([
	'up',
	'down',
	'left',
	'right',
	'arrowup',
	'arrowdown',
	'arrowleft',
	'arrowright'
]);

function isHoldAction(keys: string[]): boolean {
	return keys.length > 0 && keys.every((key) => HOLD_ACTION_KEYS.has(key));
}

function bindingsFingerprint(settings: ShortcutSettings): string {
	return JSON.stringify(
		Object.fromEntries(
			Object.entries(settings.factions).map(([faction, bindings]) => [
				faction,
				bindings.map((binding) => ({
					trigger: binding.triggerKeys,
					action: binding.actionKeys
				}))
			])
		)
	);
}

const FACTION_KEYS: FactionKey[] = ['allies', 'allies_commonwealth', 'axis', 'axis_panzer_elite'];

const MODIFIER_ORDER = ['CommandOrControl', 'Shift', 'Alt', 'Super'] as const;
type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_ALIASES: Record<Modifier, string[]> = {
	CommandOrControl: ['CmdOrControl', 'Ctrl', 'Control'],
	Shift: [],
	Alt: [],
	Super: []
};

function normalizeTriggerKey(key: string): string {
	if (key === 'Control' || key === 'Ctrl') {
		return 'CommandOrControl';
	}

	if (key === 'Cmd' || key === 'Command') {
		return 'CommandOrControl';
	}

	return key;
}

function formatTrigger(keys: string[]): string | null {
	const normalized = keys.map(normalizeTriggerKey);
	const modifiers = MODIFIER_ORDER.filter((modifier) => normalized.includes(modifier));
	const key = normalized.find((value) => !MODIFIER_ORDER.includes(value as Modifier));

	if (!key) {
		return modifiers.length > 0 ? modifiers.join('+') : null;
	}

	const normalizedKey =
		key.length === 1 && key >= 'A' && key <= 'Z'
			? `Key${key}`
			: key.length === 1 && key >= '0' && key <= '9'
				? `Digit${key}`
				: key;

	return [...modifiers, normalizedKey].join('+');
}

function unregisterVariants(trigger: string): string[] {
	const variants = new Set<string>([trigger, trigger.toLowerCase()]);

	for (const modifier of MODIFIER_ORDER) {
		for (const alias of MODIFIER_ALIASES[modifier] ?? []) {
			variants.add(trigger.replace(modifier, alias));
			variants.add(trigger.replace(modifier, alias).toLowerCase());
		}
	}

	return [...variants];
}

function collectTriggers(settings: ShortcutSettings, registered: Set<string>): Set<string> {
	return new Set([
		...registered,
		...Object.values(settings.factions)
			.flat()
			.map((shortcut) => formatTrigger(shortcut.triggerKeys))
			.filter((trigger): trigger is string => Boolean(trigger))
	]);
}

function isAlreadyRegisteredError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes('already registered');
}

function normalizeSettings(settings: ShortcutSettings) {
	for (const list of Object.values(settings.factions)) {
		for (let i = 0; i < list.length; i++) {
			const binding = list[i];

			if (!binding.id) {
				list[i] = normalizeShortcut(binding);
			}

			list[i].triggerKeys = list[i].triggerKeys.map(normalizeTriggerKey);
		}
	}
}

export class Shortcuts extends Feature<ShortcutSettings> {
	name = 'shortcuts';

	handlers = new Map<
		Shortcut,
		{
			trigger?: { handler: (e: KeyboardEvent) => void; timeout: ReturnType<typeof setTimeout> };
			action?: { handler: (e: KeyboardEvent) => void; timeout: ReturnType<typeof setTimeout> };
		}
	>();

	registeredTriggers = new Set<string>();
	private registrationQueue: Promise<void> = Promise.resolve();
	private disposeEnable?: () => void;
	private settingsRegisterTimer?: ReturnType<typeof setTimeout>;

	private runRegistration<T>(task: () => Promise<T>): Promise<T> {
		const run = this.registrationQueue.then(task);
		this.registrationQueue = run.then(
			() => undefined,
			() => undefined
		);
		return run;
	}

	private shouldRegisterShortcuts() {
		return (
			app.game.isRunning &&
			app.game.isWindowFocused &&
			!app.game.isIngameChatOpen &&
			Boolean(app.lobby?.me)
		);
	}

	private maybeRegisterShortcuts() {
		if (!this.shouldRegisterShortcuts() || app.lobby?.me == null) {
			return;
		}

		this.safeRegisterShortcuts(app.lobby.me.race);
	}

	private scheduleRegisterShortcuts() {
		clearTimeout(this.settingsRegisterTimer);
		this.settingsRegisterTimer = setTimeout(() => {
			this.maybeRegisterShortcuts();
		}, 200);
	}

	private safeRegisterShortcuts(race: number) {
		void this.registerShortcuts(race).catch((error) => {
			console.error('Failed to register shortcuts', error);
		});
	}

	private safeUnregisterAllShortcuts() {
		void this.unregisterAllShortcuts().catch((error) => {
			console.warn('Failed to unregister shortcuts', error);
		});
	}

	disable() {
		clearTimeout(this.settingsRegisterTimer);
		this.disposeEnable?.();
		this.disposeEnable = undefined;
		return this.unregisterAllShortcuts();
	}

	enable() {
		this.disposeEnable?.();

		normalizeSettings(this.settings);
		this.safeUnregisterAllShortcuts();

		this.disposeEnable = $effect.root(() => {
			const offLobby = app.on('lobby.started', () => {
				this.maybeRegisterShortcuts();
			});

			watch(
				() => app.game.isRunning,
				(isRunning) => {
					if (!isRunning) {
						this.safeUnregisterAllShortcuts();
					}
				}
			);

			watch(
				() => app.game.isWindowFocused,
				(isFocused) => {
					if (!isFocused) {
						this.safeUnregisterAllShortcuts();
					} else {
						this.maybeRegisterShortcuts();
					}
				}
			);

			watch(
				() => app.game.isIngameChatOpen,
				(isChatOpen) => {
					if (isChatOpen) {
						this.safeUnregisterAllShortcuts();
					} else {
						this.maybeRegisterShortcuts();
					}
				}
			);

			watch(
				() => `${app.lobby?.me?.race ?? ''}:${bindingsFingerprint(this.settings)}`,
				() => {
					this.scheduleRegisterShortcuts();
				}
			);

			return offLobby;
		});
	}

	private async forceUnregisterTrigger(trigger: string) {
		for (const variant of unregisterVariants(trigger)) {
			await unregister(variant).catch(() => undefined);
		}
	}

	private async registerBinding(trigger: string, actionKeys: string[]) {
		const keysToSend = actionKeysForSendKeys(actionKeys);

		const handler = (event: { state: string; shortcut: string }) => {
			if (keysToSend.length === 0) {
				return;
			}

			void (async () => {
				const modifiersMatch = await invoke<boolean>('shortcut_modifiers_match', { trigger });
				if (!modifiersMatch) {
					return;
				}

				if (event.state !== 'Pressed') {
					return;
				}

				await invoke('send_keys', { keys: keysToSend });
			})().catch((error) => {
				console.error('Failed to send shortcut action keys', error);
			});
		};

		await this.forceUnregisterTrigger(trigger);

		let [, error] = t(await register(trigger, handler));

		if (error && isAlreadyRegisteredError(error)) {
			await this.forceUnregisterTrigger(trigger);
			[, error] = t(await register(trigger, handler));
		}

		if (error && isAlreadyRegisteredError(error)) {
			this.registeredTriggers.add(trigger);
			return;
		}

		if (error) {
			throw error;
		}

		this.registeredTriggers.add(trigger);
	}

	private async syncHoldBindings(
		bindings: { trigger: string; actionKeys: string[] }[],
		enabled: boolean
	) {
		await invoke('sync_hold_bindings', { enabled, bindings }).catch((error) => {
			console.error('Failed to sync hold bindings', error);
		});
	}

	async registerShortcuts(race: number) {
		if (!this.shouldRegisterShortcuts()) {
			return;
		}

		return this.runRegistration(async () => {
			await this.unregisterAllShortcutsInternal();

			const factionMap: { [key: number]: Shortcut[] } = {
				0: this.settings.factions.allies,
				1: this.settings.factions.axis,
				2: this.settings.factions.allies_commonwealth,
				3: this.settings.factions.axis_panzer_elite
			};

			const shortcutsToRegister = factionMap[race] || [];
			const seenTriggers = new Set<string>();
			const holdBindings: { trigger: string; actionKeys: string[] }[] = [];

			for (const shortcut of shortcutsToRegister) {
				const trigger = formatTrigger(shortcut.triggerKeys);

				if (!trigger || seenTriggers.has(trigger)) {
					continue;
				}

				seenTriggers.add(trigger);

				const keysToSend = actionKeysForSendKeys(shortcut.actionKeys);

				if (isHoldAction(keysToSend)) {
					holdBindings.push({ trigger, actionKeys: keysToSend });
					continue;
				}

				try {
					await this.registerBinding(trigger, [...shortcut.actionKeys]);
				} catch (error) {
					console.error('Error registering shortcut', trigger, error);
				}
			}

			await this.syncHoldBindings(holdBindings, true);
		});
	}

	getBindings(faction: FactionKey) {
		return this.settings.factions[faction];
	}

	addBinding(faction: FactionKey) {
		this.settings.factions[faction].push(createShortcut());
	}

	removeBinding(faction: FactionKey, id: string) {
		const list = this.settings.factions[faction];
		const index = list.findIndex((binding) => binding.id === id);
		if (index === -1) {
			return;
		}

		const binding = list[index];
		this.stopRecording(binding);
		this.handlers.delete(binding);
		list.splice(index, 1);
	}

	moveBinding(faction: FactionKey, fromIndex: number, toIndex: number) {
		const list = this.settings.factions[faction];
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
			return;
		}

		const [moved] = list.splice(fromIndex, 1);
		list.splice(toIndex, 0, moved);
	}

	stopAllRecording() {
		for (const shortcut of [...this.handlers.keys()]) {
			this.stopRecording(shortcut);
		}
		this.handlers.clear();
	}

	stopRecording(keybinding: Shortcut) {
		if (keybinding.isRecordingTriggerKeys) {
			this.record(keybinding, 'trigger');
		}
		if (keybinding.isRecordingActionKeys) {
			this.record(keybinding, 'action');
		}
	}

	async validateSettings(settings: Partial<ShortcutSettings>): Promise<ShortcutSettings> {
		const validated = await super.validateSettings(settings);
		normalizeSettings(validated);
		return validated;
	}

	async unregisterAllShortcuts() {
		return this.runRegistration(() => this.unregisterAllShortcutsInternal());
	}

	private async unregisterAllShortcutsInternal() {
		const triggers = collectTriggers(this.settings, this.registeredTriggers);

		await Promise.all([
			unregisterAll().catch(() => undefined),
			invoke('reset_global_shortcuts').catch(() => undefined),
			invoke('release_all_held_keys').catch(() => undefined),
			invoke('sync_hold_bindings', { enabled: false, bindings: [] }).catch(() => undefined)
		]);

		for (const trigger of triggers) {
			await this.forceUnregisterTrigger(trigger);
		}

		this.registeredTriggers.clear();
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

				if (code.startsWith('Key')) return code;
				if (code.startsWith('Digit')) return code;
				if (code.startsWith('Numpad')) return code;

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
