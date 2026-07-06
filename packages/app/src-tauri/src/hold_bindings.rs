//! Hold-to-activate key remaps (e.g. W -> ArrowUp) handled synchronously in the
//! low-level keyboard hook so modifier keys are checked at the exact key event.
//! Key injection is deferred to a worker thread to avoid hook re-entrancy deadlocks.

use crate::input::{self, TriggerModifier};
use enigo::Direction;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::mpsc::{self, Sender};
use std::sync::{LazyLock, Mutex, OnceLock, TryLockError};
use std::thread;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HoldBindingInput {
    pub trigger: String,
    pub action_keys: Vec<String>,
}

struct ParsedHoldBinding {
    trigger_vk: u32,
    action_keys: Vec<String>,
    required_modifiers: HashSet<TriggerModifier>,
}

struct HoldBindingState {
    enabled: bool,
    bindings: Vec<ParsedHoldBinding>,
    active: HashMap<u32, Vec<String>>,
}

enum InputJob {
    Press(Vec<String>),
    Release(Vec<String>),
}

static STATE: LazyLock<Mutex<HoldBindingState>> = LazyLock::new(|| {
    Mutex::new(HoldBindingState {
        enabled: false,
        bindings: Vec::new(),
        active: HashMap::new(),
    })
});

static INPUT_JOBS: OnceLock<Sender<InputJob>> = OnceLock::new();

fn ensure_input_worker() {
    INPUT_JOBS.get_or_init(|| {
        let (tx, rx) = mpsc::channel();

        thread::spawn(move || {
            while let Ok(job) = rx.recv() {
                match job {
                    InputJob::Press(keys) => {
                        let _ = input::send_action_keys(&keys, Direction::Press, false);
                    }
                    InputJob::Release(keys) => {
                        let _ = input::send_action_keys(&keys, Direction::Release, false);
                    }
                }
            }
        });

        tx
    });
}

fn queue_input(job: InputJob) {
    ensure_input_worker();
    if let Some(tx) = INPUT_JOBS.get() {
        let _ = tx.send(job);
    }
}

#[tauri::command]
pub fn sync_hold_bindings(enabled: bool, bindings: Vec<HoldBindingInput>) -> Result<(), String> {
    ensure_input_worker();

    let mut state = STATE.lock().map_err(|e| e.to_string())?;

    if !enabled {
        release_active_holds(&mut state)?;
        state.bindings.clear();
        state.enabled = false;
        return Ok(());
    }

    let mut parsed = Vec::new();

    for binding in bindings {
        let Some((trigger_vk, required_modifiers)) = input::parse_trigger(&binding.trigger) else {
            continue;
        };

        if binding.action_keys.is_empty() {
            continue;
        }

        parsed.push(ParsedHoldBinding {
            trigger_vk,
            action_keys: binding.action_keys,
            required_modifiers,
        });
    }

    release_active_holds(&mut state)?;
    state.bindings = parsed;
    state.enabled = true;

    Ok(())
}

fn release_active_holds(state: &mut HoldBindingState) -> Result<(), String> {
    if !state.active.is_empty() {
        for action_keys in state.active.values() {
            input::send_action_keys(action_keys, Direction::Release, false)?;
        }
        state.active.clear();
    }

    input::release_all_held_internal()?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn handle_key(vk: u32, is_key_up: bool, is_repeat: bool) -> bool {
    ensure_input_worker();

    let job = {
        let mut state = match STATE.try_lock() {
            Ok(state) => state,
            Err(TryLockError::WouldBlock) => return false,
            Err(TryLockError::Poisoned(_)) => return false,
        };

        if !state.enabled {
            return false;
        }

        let pressed = input::pressed_modifiers();

        if is_key_up {
            let Some(action_keys) = state.active.remove(&vk) else {
                return false;
            };

            Some(InputJob::Release(action_keys))
        } else if is_repeat {
            return state.active.contains_key(&vk);
        } else {
            let Some(binding) = find_binding(&state.bindings, vk, &pressed) else {
                return false;
            };

            let action_keys = binding.action_keys.clone();
            state.active.insert(vk, action_keys.clone());
            Some(InputJob::Press(action_keys))
        }
    };

    if let Some(job) = job {
        queue_input(job);
        return true;
    }

    false
}

#[cfg(not(target_os = "windows"))]
pub fn handle_key(_vk: u32, _is_key_up: bool, _is_repeat: bool) -> bool {
    false
}

fn find_binding<'a>(
    bindings: &'a [ParsedHoldBinding],
    vk: u32,
    pressed: &HashSet<TriggerModifier>,
) -> Option<&'a ParsedHoldBinding> {
    bindings
        .iter()
        .filter(|binding| binding.trigger_vk == vk)
        .filter(|binding| input::modifiers_match(&binding.required_modifiers, pressed))
        .max_by_key(|binding| binding.required_modifiers.len())
}

pub fn clear_active_holds() -> Result<(), String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    release_active_holds(&mut state)
}
