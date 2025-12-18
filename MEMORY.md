# Memory Consumption Overview

This document outlines potential areas within the `FkNoobsCoH` application that may contribute to high memory usage (RAM). It identifies specific components, features, and coding patterns found in the workspace that are likely candidates for optimization.

## 1. Replay Parsing & Processing (High Impact)

The replay analysis feature involves reading binary files and parsing them into structured objects. This is likely the most memory-intensive operation in the app.

- **Worker Implementation (`src/lib/workers/replay.worker.ts`)**:
  - **Issue**: The worker receives the entire file content as a `Uint8Array` (`data.content`). For large replay files, this raw buffer consumes significant memory.
  - **Parsing**: `const replay = parseReplay(data.content)` creates a full object representation of the replay in memory. While a `simplifiedReplay` is extracted later, the full object (containing every game command and tick) exists temporarily.
  - **Serialization**: Transferring large objects between the main thread and the worker (via `postMessage`) involves serialization/deserialization, which can double memory usage for that data during transit.

- **Batch Processing (`src/lib/core/app/features/replay-analyzer/analyzer.svelte.ts`)**:
  - **Issue**: If the analyzer scans a directory and processes multiple replays simultaneously or keeps the results of many parsed replays in memory (e.g., in a list or cache), RAM usage will spike linearly with the number of files.

## 2. Monaco Editor (Twitch Overlays)

The application includes a code editor for Twitch overlays.

- **Component (`src/routes/twitch/tabs/overlays-tab/overlays-tab.svelte`)**:
  - **Library**: `monaco-editor` is a heavy library. Instantiating it consumes a baseline amount of memory (tens of MBs).
  - **File Content**: The `openFiles` state array stores the full string content of every opened file (`content` and `originalContent`). If users open multiple large files (HTML, JS, CSS) without closing tabs, these strings remain in memory.
  - **Disposal**: Ensure that the editor instance (`editor` state) and its models are properly disposed of when the component is destroyed or tabs are closed to prevent leaks.

## 3. Large Lists & State Management

Svelte 5's reactivity system (`$state`) is efficient, but holding large datasets in memory affects performance.

- **Match History (`src/routes/history/+page.svelte`)**:
  - **Issue**: `app.database.lobbies.getList` appears to fetch lists of matches. If this query returns thousands of records without pagination (e.g., fetching all history at once), the resulting array of objects will consume substantial heap space.
  - **Reactivity**: Wrapping large arrays in `$state` or `resource` adds overhead for dependency tracking.

- **Replay Lists (`src/routes/replays/+page.svelte`)**:
  - **Issue**: Similar to history, if the replay list loads metadata for all available replays into memory at once, it will scale poorly as the user's collection grows.

## 4. File System Operations

- **Reading Files (`src/lib/core/app/features/replay-analyzer/analyzer.svelte.ts`)**:
  - **Issue**: The use of `readFile` (from `@tauri-apps/plugin-fs`) loads the entire file into memory. If used in a loop without garbage collection having a chance to run, or if multiple files are read in parallel (e.g., `Promise.all`), this causes spikes.

## 5. Assets & Images

- **Flag Images (`src/lib/utils.ts`)**:
  - **Issue**: Imports like `import WMFlag from '$lib/files/wm.png';` often result in the image being bundled as a base64 string or a URL. If these are base64 strings and used frequently in large lists (e.g., every row in a leaderboard or history table), it increases the DOM memory footprint.

## 6. Recommendations for Optimization

1.  **Replay Parsing**:
    - Use **Streams** if possible to parse replays chunk-by-chunk instead of loading the whole file.
    - Ensure the worker explicitly releases references to the raw `Uint8Array` and the full `replay` object immediately after extraction.
    - Process replays in a **queue** (one by one) rather than in parallel to cap maximum memory usage.

2.  **Data Fetching**:
    - Implement **Pagination** or **Virtual Scrolling** for the History and Replays pages. Only load the data currently visible to the user.
    - Use `LIMIT` and `OFFSET` in database queries.

3.  **Editor**:
    - Limit the number of open tabs in the overlay editor.
    - Ensure `editor.dispose()` is called in the `onDestroy` lifecycle hook.

4.  **General**:
    - Profile memory usage using the Chrome DevTools (attached to the Tauri webview) to identify specific leaking objects.
    - Check for event listener leaks in `Emittery` (used in `App` class) by ensuring `.off()` is called for every `.on()`.
