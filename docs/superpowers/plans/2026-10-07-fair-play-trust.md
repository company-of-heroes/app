# Fair Play Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fewer antivirus false positives and less "trojan" distrust of the desktop app's fair play checks. Do this by removing the behaviour that looks most like spyware, asking users for consent, and explaining publicly what fair play does.

**Architecture:** There are six workstreams. Tasks 1 and 5 are release and ops work: the signing guard and AV vendor submissions. Tasks 2 and 3 are native Rust changes in `packages/app/src-tauri`: input hooks only while the game runs, and no more registry or Snipping Tool tampering. Task 4 is an app feature change: fair play becomes opt-in with a consent dialog. Task 6 is a public website page, plus `POLICY.md` and copy updates.

**Tech Stack:** Tauri 2 (Rust, `windows` 0.52 crate), Svelte 5 runes, SvelteKit (website on Cloudflare), pnpm + Turbo, GitHub Actions, Azure Artifact Signing.

**Spec:** The conversation of 2026-10-07 (user feedback: "fairplay is a trojan horse / virus"). Findings that this plan relies on:
- The release workflow already signs with Authenticode. v0.69.0 `*-setup.exe`, the installed `fknoobscoh.exe` and `uninstall.exe` are all `Valid`, signed `CN=Code IT Ninja` with a Microsoft timestamp. Signing is **silently skipped** if `AZURE_CLIENT_ID` is missing (`.github/workflows/windows-release.yml:72`).
- `coh_chat::start_listener` installs global `WH_KEYBOARD_LL` + `WH_MOUSE_LL` hooks at app startup (`lib.rs:108`) and keeps them for the whole app lifetime. Their only consumers are game-only: the chat Enter/Escape events (`core/game/process.svelte.ts:48-54`), hold bindings (`hold_bindings::handle_key`) and the fair-play input lock.
- `capture.rs::capture_via_print_screen` writes `HKCU\...\PrintScreenKeyForSnippingEnabled`, injects a hardware Print Screen keystroke and kills Snipping Tool processes it spawned. The Windows Graphics Capture fallback already exists (`capture_window_frame`).
- Fair play defaults to `enabled: true` (`anti-cheat.svelte.ts:221`). `POLICY.md` §d and the website `fair-play-section.svelte` say "on by default" and "uses Print Screen".
- Repo `company-of-heroes/app` is **public**, so the explanation page can link to the source.

## Global Constraints

- **No tests**: do not add test files or cases (`.claude/rules/cursor/no-tests.md`). Each task is verified with `cargo check`, `pnpm check`, `svelte-autofixer` and a manual run.
- All user-visible strings go through `t('English key')`, with the key added to `packages/i18n/locales/{en,es,ko}.json`.
- Raw clickable elements need `cursor-pointer`. Prefer `Button` from `@company-of-heroes/ui/button`.
- Use Prettier spacing. Wrap every `if` body in `{ }`.
- Register each Tauri command in `generate_handler![]` (`src-tauri/src/lib.rs`) and call it from TS with camelCase args.
- Write one changeset for the whole effort, `.changeset/fair-play-trust.md`, with `'@company-of-heroes/app': minor` and `'@company-of-heroes/website': patch`. Check `.changeset/` first and do not add a second one. Do not hand-edit `CHANGELOG.md`.
- `POLICY.md` changes are material (default flips to opt-in), so set a new **Effective date**.
- Do not bump versions yourself.

## Review Focus

1. **Game closes or crashes while hooks are installed.** Expected: the hooks are removed within one 1 s poll and the hook thread exits. App exit with the game running leaves no orphan thread that blocks shutdown. Owned by Task 2, verified in Step 4.
2. **Hold bindings or chat detection when the app starts *after* the game is already running.** Expected: the hooks get installed on the first poll, and remaps and Enter/Escape work without restarting. Task 2, Step 4.
3. **Exclusive-fullscreen CoH with Print Screen removed.** Expected: the WGC capture is non-blank. If it is blank, the capture fails, no upload happens and the retry logic stops after `MAX_CAPTURE_RETRIES`. It must never fall back to a desktop shot. Task 3, Step 1 decides the variant, Step 4 verifies it.
4. **Existing user who closes the consent dialog without choosing.** Expected: their current `enabled` value is kept, and the dialog does not reappear next start. A new user who closes it stays off. Task 4, Step 4.
5. **Release run without Azure secrets (fork or expired secret).** Expected: a tag release fails loudly instead of publishing an unsigned installer. Workflow-dispatch dry runs may still skip. Task 1, Step 2.

---

### Task 1: Signing guard + signature verification in CI

**Files:**
- Modify: `.github/workflows/windows-release.yml:60-135` (the `codesign` step) and add a verification step after the `tauri-action` build step.

**Interfaces:**
- Produces: release assets that are guaranteed signed. Task 5 relies on that.

- [ ] **Step 1: Make missing signing secrets fatal for release builds.** In the `Enable Windows Authenticode signing` step, replace the `Write-Host "Skipping…"` early exit with `throw 'AZURE_CLIENT_ID is not set; refusing to build an unsigned release.'` when `github.event_name` is `push` (tag) or `release`. Keep the skip only for `workflow_dispatch`. Pass `GITHUB_EVENT_NAME` into the step env.
- [ ] **Step 2: Add a `Verify Authenticode signatures` step** after the build (`if: steps.codesign.outputs.enabled == 'true'`, `shell: pwsh`). It finds all `*.exe` and `*.msi` under `packages/app/src-tauri/target/release/bundle/**` plus `target/release/fknoobscoh.exe`. On each it runs `Get-AuthenticodeSignature`, and it `throw`s unless `Status -eq 'Valid'` and `SignerCertificate.Subject -like '*O=Code IT Ninja*'` and `TimeStamperCertificate` is not null. Print one line per file.
- [ ] **Step 3: Apply the same guard and verify step to `.github/workflows/replay-parser-release.yml`**, which has the identical signing block at lines 53-110.
- [ ] **Step 4: Verify.** Run `gh workflow run windows-release.yml` (dispatch) on a branch and check that the verify step lists every bundle as `Valid`. Run `actionlint .github/workflows/*.yml` if it is installed.
- [ ] **Step 5: Commit**

```bash
git add .github/workflows/windows-release.yml .github/workflows/replay-parser-release.yml
git commit -m "ci; fail releases that would ship unsigned and verify Authenticode on every bundle"
```

### Task 2: Install input hooks only while Company of Heroes runs

**Files:**
- Modify: `packages/app/src-tauri/src/coh_chat.rs:190-228` (hook thread lifecycle)
- Modify: `packages/app/src-tauri/src/lib.rs:60-70,108` (register commands, drop the startup call)
- Modify: `packages/app/src-tauri/Cargo.toml` (only if `PostThreadMessageW`/`GetCurrentThreadId` need extra `windows` features; `Win32_System_Threading` and `Win32_UI_WindowsAndMessaging` are already enabled)
- Modify: `packages/app/src/lib/core/game/process.svelte.ts:80-95,145-155`

**Interfaces:**
- Produces Rust: `#[tauri::command] pub fn start_input_hooks(app: AppHandle) -> Result<(), String>` and `#[tauri::command] pub fn stop_input_hooks() -> Result<(), String>`. Both are idempotent.
- Produces TS: `invoke('start_input_hooks')` / `invoke('stop_input_hooks')`, called only from `GameProcess` when `isRunning` flips.
- Keeps: `arm_user_input_lock`, `lock_user_input` and `unlock_user_input` unchanged. With no hooks installed the lock is simply a no-op, which is correct because there is no game to protect.

- [ ] **Step 1: Make the hook thread stoppable in `coh_chat.rs`.** Add `static HOOK_THREAD_ID: AtomicU32`. In `run_input_hook_thread`, store `GetCurrentThreadId()` before `GetMessageW`. `stop_input_hooks` calls `PostThreadMessageW(id, WM_QUIT, WPARAM(0), LPARAM(0))` when `id != 0` and then sets it to 0. The existing unhook code after the loop already runs on `WM_QUIT`. `start_input_hooks` sets `APP_HANDLE` (still `OnceLock`, so `let _ = set`) and spawns the thread only when `HOOK_THREAD_ID == 0`. Use `compare_exchange` on a separate `AtomicBool HOOKS_STARTING` so that two quick calls cannot spawn two threads. `stop_input_hooks` also calls `unlock_user_input()` and `hold_bindings::clear_active_holds()`. Non-Windows builds: both are `Ok(())`. Rename `start_listener` to `start_input_hooks` (do not keep both).
- [ ] **Step 2: Wire the commands.** In `lib.rs`, add `coh_chat::start_input_hooks` and `coh_chat::stop_input_hooks` to `generate_handler![]` and delete the `coh_chat::start_listener(app.handle());` call from `setup`. In `process.svelte.ts`, inside `#pollProcessRunning` where `running !== this.isRunning`, call `void invoke(running ? 'start_input_hooks' : 'stop_input_hooks').catch(...)` (log with `console.warn('[GAME]: …')`). Also call `stop_input_hooks` in `stop()` next to `this.isRunning = false` (line ~151).
- [ ] **Step 3: Static checks.** Run `cargo check --manifest-path packages/app/src-tauri/Cargo.toml` and `pnpm --filter @company-of-heroes/app check`. Run `svelte-autofixer` on `process.svelte.ts` until clean. Expected: no errors.
- [ ] **Step 4: Manual verification** (`pnpm --filter @company-of-heroes/app tauri dev`):
  - Without CoH running, run Sysinternals `handle`, or in an elevated PowerShell use `Get-Process fknoobscoh` together with a temporary `console.info` in Step 2 to confirm no `start_input_hooks` call happened.
  - Start CoH: the hold binding W→ArrowUp works, and the in-game chat Enter/Escape toggles the app's chat-open state.
  - Close CoH: within about 1 s the `stop_input_hooks` log appears, and keyboard input in other apps is unaffected.
  - Start the app while CoH is already running: remaps work on the first poll (Review Focus 2).
  - Quit the app with CoH running: the process exits without hanging (Review Focus 1).
- [ ] **Step 5: Commit**

```bash
git add packages/app/src-tauri/src/coh_chat.rs packages/app/src-tauri/src/lib.rs packages/app/src/lib/core/game/process.svelte.ts
git commit -m "enhance; only install keyboard and mouse hooks while Company of Heroes is running"
```

### Task 3: Remove registry edits, synthetic Print Screen and Snipping Tool kills from capture

**Files:**
- Modify: `packages/app/src-tauri/src/capture.rs` (delete lines ~99-360: `press_print_screen`, `SnippingHotkeyGuard`, `snipping_hotkey_value`, `set_snipping_hotkey`, `restore_snipping_hotkey`, `notify_keyboard_setting_changed`, `snipping_pids`, `close_new_snipping`, `resolve_screenshots_dir`, `list_screenshot_files`, `capture_via_print_screen`)
- Modify: `packages/app/src-tauri/Cargo.toml` (drop `Win32_System_Registry` if no other module uses it; `grep -rn Registry src/` first, because `steam.rs` may use it)
- Modify: `packages/app/src/lib/core/app/features/anti-cheat/anti-cheat.svelte.ts:616-625`

**Interfaces:**
- Changes: `capture_game_window() -> Result<GameWindowCapture, String>` takes **no arguments**. `screenshots_dir` and `keep_screenshot` are removed.
- Keeps: the `GameWindowCapture { jpegBase64, width, height }` shape.

- [ ] **Step 1: Spike — does WGC alone capture CoH in every display mode?** On the dev build, temporarily skip the Print Screen branch in `capture_game_window_sync`. Capture in **windowed**, **borderless** and **exclusive fullscreen** (CoH options → screen mode), with `keepScreenshot`-style local saving of the encoded JPEG to the scratchpad. Record which modes give a non-blank frame. Decision rule:
  - All three non-blank → continue with Step 2 as written.
  - Exclusive fullscreen blank → still delete the registry, Snipping Tool and keystroke code. In fullscreen, `capture_game_window_sync` returns `Err("Company of Heroes capture was blank")`, so the capture is skipped and no evidence is uploaded. Add the line "Screenshots are skipped in exclusive fullscreen; use borderless" to the Task 6 page. Do **not** keep the Print Screen path.
- [ ] **Step 2: Simplify `capture_game_window_sync(coh_pid)`** to: `relic_coh_pid` → `ensure_coh_foreground` → `pick_coh_window` → `capture_window_frame` → `is_blank_frame` check → `ensure_coh_foreground` → `encode_jpeg`. Delete the functions listed under **Files** and their imports. Keep `is_blank_frame`, `pick_coh_window`, `ensure_coh_foreground`, `foreground_pid` and `relic_coh_pid`. If `windows-capture` 2 exposes `DrawBorderSettings::WithoutBorder`, pass it in `capture_window_frame_with` so that Windows 11 does not draw the yellow capture border on the game. Leave it at default if the API is not there.
- [ ] **Step 3: Update the caller.** In `#captureWithRetry`, drop the `warningsLog`/`screenshotsDir` lookup and call `invoke<GameWindowCapture>('capture_game_window')`. Remove the now-unused `dirname`/`join` imports and the `dev` import if nothing else uses it (`#scheduleCaptures` still uses `dev`, so keep it there). Run `svelte-autofixer` on the file.
- [ ] **Step 4: Verify.**
  - `cargo check` and `pnpm --filter @company-of-heroes/app check` are clean.
  - Play a dev match (dev capture delays: 1 s / 5 s / 10 s). Three records appear in `anti_cheat_captures` with game images.
  - `reg query "HKCU\Control Panel\Keyboard" /v PrintScreenKeyForSnippingEnabled` shows the same value before and after the match.
  - No `SnippingTool.exe` was started or killed.
  - No new files appear in `My Games\Company of Heroes Relaunch\Screenshots`.
  - In exclusive fullscreen, the behaviour matches the Step 1 decision (Review Focus 3).
- [ ] **Step 5: Commit**

```bash
git add packages/app/src-tauri/src/capture.rs packages/app/src-tauri/Cargo.toml packages/app/src/lib/core/app/features/anti-cheat/anti-cheat.svelte.ts
git commit -m "enhance; fair play screenshots use window capture only, no registry changes or simulated Print Screen"
```

### Task 4: Fair play opt-in with a one-time consent dialog

**Files:**
- Create: `packages/app/src/lib/core/app/features/anti-cheat/consent-prompt.svelte` (modelled on `chat-announce-prompt.svelte`)
- Modify: `packages/app/src/lib/core/app/features/anti-cheat/anti-cheat.svelte.ts:19-23,214-256`
- Modify: `packages/app/src/routes/(loaded)/settings/+page.svelte:253-275` (add a "What does fair play do?" link to the Task 6 page)
- Modify: `packages/i18n/locales/{en,es,ko}.json`

**Interfaces:**
- Changes `AntiCheatSettings` to `{ enabled: boolean; announceInChat: boolean; chatAnnouncePromptSeen: boolean; consentPromptSeen: boolean }`.
- `defaultSettings()` returns `{ enabled: false, announceInChat: false, chatAnnouncePromptSeen: false, consentPromptSeen: false }`.
- `consent-prompt.svelte` props: `{ onConfirm: () => void; onCancel: () => void }`. This is the same contract as `ChatAnnouncePrompt`.
- Consumes: the Task 6 page URL `https://coh1stats.com/fair-play`, opened via the existing opener (`https://coh1stats.com/*` is already allowed).

**Decision (recommended; confirm with the user before executing):** **every** install sees the dialog once, new and existing. New installs default to off. Existing installs keep their current `enabled` value if they dismiss the dialog. "Turn on" sets `enabled = true` and "No thanks" sets `enabled = false`. Rewards and "Fair play matches" stats keep working off whatever is recorded.

- [ ] **Step 1: Consent prompt component.** It reuses `Button` and the modal body layout from `chat-announce-prompt.svelte`. Copy (all via `t()`):
  - Intro: "Fair play helps catch cheaters in Company of Heroes matches. It only runs while you are in a live match."
  - "What it does" list:
    - "Takes 2–5 screenshots of the Company of Heroes window during a match"
    - "Checks running program names against a list of known cheat tools"
    - "Reports unknown DLLs loaded into RelicCOH.exe"
  - "What it never does" list:
    - "Capture your desktop or other apps"
    - "Read your files, passwords or keystrokes"
    - "Run anything outside the game"
  - Link: "Read the full explanation" (raw `<a>` with `cursor-pointer` via `interactive`, opening the Task 6 URL).
  - Buttons: "Turn on fair play" (primary) and "No thanks".
- [ ] **Step 2: Wire the prompt in `anti-cheat.svelte.ts`.** Generalize `#maybePromptChatAnnounce` / `#showChatAnnouncePrompt` into one `#prompt(component, title, description): Promise<boolean | null>`, where `null` means dismissed. Do not copy the 50-line promise block. Order on `register()`/`enable()`: the consent prompt first if `!consentPromptSeen`, then the chat-announce prompt only if fair play ended up enabled. Because `enabled` now gates `enable()`, the consent prompt must be triggered from `register()` after `super.register()`, not from `enable()`. Apply the Decision mapping, then set `consentPromptSeen = true`. Title: `t('Turn on fair play checks?')`. Description: `t('Fair play is off until you choose. You can change this any time in Settings.')`.
- [ ] **Step 3: Settings link + locales.** Under the "Fair play checks" group in settings, add a `t('What does fair play do?')` link to the Task 6 URL. Add every new key to en/es/ko (translate es/ko). Run `svelte-autofixer` on all touched `.svelte`/`.svelte.ts` files.
- [ ] **Step 4: Verify.**
  - Fresh profile (rename `%APPDATA%\com.fknoobscoh.app` settings store): the dialog appears once and fair play is off. "Turn on" → the checkbox in Settings is on, and the chat-announce prompt follows.
  - Existing profile with `enabled: true`: dismissing via the X keeps it on and the dialog does not return on restart (Review Focus 4).
  - "No thanks" → off, and no captures happen in a dev match.
  - `pnpm --filter @company-of-heroes/app check` is clean.
- [ ] **Step 5: Commit**

```bash
git add packages/app/src/lib/core/app/features/anti-cheat packages/app/src/routes/(loaded)/settings/+page.svelte packages/i18n/locales
git commit -m "feat; fair play is opt-in with a one-time consent dialog"
```

### Task 5: Antivirus false-positive submissions (ops, no code)

**Files:**
- Create: `docs/release/av-submissions.md` (runbook; a checklist, not product code)

**Interfaces:**
- Consumes: a signed installer from Task 1 that contains Tasks 2–4. Submit **after** that release, so vendors whitelist the new, less suspicious binary.

- [ ] **Step 1: Write the runbook.** One section per vendor, each with the URL, what to upload (`*-setup.exe` + `fknoobscoh.exe`) and the standard text: "Signed by Code IT Ninja (Azure Artifact Signing). Open source: https://github.com/company-of-heroes/app. Companion app for Company of Heroes 1; fair play checks are opt-in and documented at https://coh1stats.com/fair-play". Vendors:
  - Microsoft Defender: https://www.microsoft.com/wdsi/filesubmission (choose "Software developer", "Incorrectly detected")
  - Avast/AVG: https://www.avast.com/false-positive-file-form.php
  - Kaspersky: https://opentip.kaspersky.com
  - ESET: samples@eset.com
  - Bitdefender: https://www.bitdefender.com/consumer/support/answer/29358/
  - Norton: https://submit.norton.com
  - McAfee: https://www.mcafee.com/en-us/consumer-support/dispute-detection-allowlisting.html
  - Also: check the release on https://www.virustotal.com before and after submitting, and record detections in the runbook's log table (date, version, detections).
- [ ] **Step 2: Do the first round** for the release that ships Tasks 2–4. Record the VirusTotal score before and after.
- [ ] **Step 3: Commit**

```bash
git add docs/release/av-submissions.md
git commit -m "docs; antivirus false-positive submission runbook"
```

### Task 6: Public "What fair play does" page + policy and copy updates

**Files:**
- Create: `packages/website/src/routes/fair-play/+page.svelte` (+ `+page.server.ts` only if `privacy/` uses one for meta; mirror `privacy/`)
- Modify: `packages/website/src/lib/components/home/fair-play-section.svelte:17-55` (fix the "Print Screen" and "on by default" copy, add a link to `/fair-play`)
- Modify: `packages/website/src/routes/sitemap.xml` (add `/fair-play` for each locale, following the existing entries)
- Modify: `POLICY.md` §d (lines ~79-86) + the Effective date
- Modify: `packages/i18n/locales/{en,es,ko}.json`
- Create: `.changeset/fair-play-trust.md`

**Interfaces:**
- Produces: the route `/fair-play` (plus `/es/fair-play` and `/ko/fair-play` through the existing locale prefixing), which Task 4 links to.

- [ ] **Step 1: Page content.** Sections, each a heading + short paragraph or list, all via `locals.t`/`useI18n`. Reuse existing website primitives (check `@company-of-heroes/ui` and `packages/website/src/lib/components/ui/` first) and match the `privacy` page layout.
  1. "Is the companion app a virus?" — No. It is signed by Code IT Ninja and the source is public (link to the GitHub repo). Show how to check: right-click the installer → Properties → Digital Signatures.
  2. "Why might antivirus warn?" — Anti-cheat and hotkey features use Windows APIs that malware also uses: keyboard hooks for hotkeys and chat detection, window capture, and listing processes and DLLs. List each one, say when it runs, and give the source file link (`coh_chat.rs`, `capture.rs`, `process_check.rs`, `module_check.rs`).
  3. "What fair play does / never does" — the same lists as the Task 4 dialog (reuse the same i18n keys).
  4. "Turning it off" — Settings → Fair play checks. It is off until you opt in.
  5. "Reporting a false positive" — link to Discord / the vendor list summary.
  6. If Task 3 Step 1 found exclusive fullscreen blank: the fullscreen note.
- [ ] **Step 2: Update `fair-play-section.svelte`.** The screenshots description becomes "During a match the app captures only the Company of Heroes window (never your desktop) and uploads it for review." The intro "on by default" sentence becomes "Fair play checks are off until you turn them on in the app." Add a "How fair play works" link to `href('/fair-play')`.
- [ ] **Step 3: Update `POLICY.md` §d.**
  - "on by default" → "off until you turn them on (the app asks once)".
  - Replace the Print Screen bullet with: "capture the Company of Heroes window (only while the game is in the foreground) and upload that image for review and analysis…". Keep the "we do not capture the Windows desktop…" sentence.
  - Add: "The app installs keyboard and mouse hooks only while Company of Heroes is running, for in-game chat detection, hold-to-activate key remaps and the optional all-chat announce. Keystrokes are not recorded or uploaded."
  - Set a new Effective date.
- [ ] **Step 4: Changeset** `.changeset/fair-play-trust.md`:

```markdown
---
'@company-of-heroes/app': minor
'@company-of-heroes/website': patch
---

enhance; fair play is opt-in, only hooks input while the game runs, captures the game window without touching Windows settings, and has a public explanation page
```

- [ ] **Step 5: Verify.** Run `pnpm --filter @company-of-heroes/website check` and `svelte-autofixer` on the new and edited `.svelte` files. Run `pnpm --filter @company-of-heroes/website dev` and open `/fair-play`, `/es/fair-play`, `/ko/fair-play`, the home `#fair-play` link and `/privacy` (it renders the new §d). Check at phone width with no horizontal scroll. Run `pnpm check:duplicates`.
- [ ] **Step 6: Commit**

```bash
git add packages/website POLICY.md packages/i18n/locales .changeset/fair-play-trust.md
git commit -m "feat; public fair play explanation page and opt-in policy update"
```

---

## Order

Task 1 can go first or in parallel because it is independent. Then Tasks 2 and 3 (native, independent of each other), then Task 4, then Task 6 (needs the final behaviour for its copy). Release, then Task 5.
