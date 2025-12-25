# FkNoobsCoH - Performance & Architecture Analysis

## 1. UI Performance Bottlenecks (The "Laggy List" Issue)

The lag experienced on the History and Replays pages when rendering ~50 items is likely caused by **DOM complexity** and **expensive per-row initializations**.

### A. The Tooltip Explosion

In `src/routes/(loaded)/replays/replay-table.svelte` and `src/routes/(loaded)/history/match-table.svelte`, you are iterating over players and attaching a tooltip to every single faction flag/image.

```svelte
<!-- src/routes/(loaded)/replays/replay-table.svelte -->
{#each allies as player}
	<img ... {@attach tooltip(player.name)} />
{/each}
```

- **The Problem:** If you have 50 rows, and each row has ~4-8 players (depending on game size), you are initializing **200-400 individual tooltip event listeners/instances** simultaneously.
- **Impact:** This causes significant "Scripting" time during the initial render, freezing the main thread.
- **Solution:** Use **Event Delegation**. Attach a single tooltip listener to the table container that looks up the `data-tooltip` attribute of the hovered target, or use a "Singleton" tooltip instance that moves around.

### B. Image Rendering & Layout Thrashing

The tables render many small images (faction flags, rank icons, map images).

- **The Problem:**
  1.  **Unoptimized Assets:** If the source images (e.g., `$lib/files/ct_branchbanner_...`) are high-resolution but displayed at `w-4` (16px), the browser has to decode the full image and downscale it. 400 images x 2MB decoding = massive memory/GPU spike.
  2.  **Layout Thrashing:** The `TD` component uses `width="3/24"`. If this is calculated via JS or complex Flexbox without fixed table layout (`table-layout: fixed`), the browser recalculates geometry for the whole table every time an image loads.
- **Solution:**
  - Ensure images are resized/optimized for their display size.
  - Add `loading="lazy"` to images below the fold.
  - Enforce `table-layout: fixed` in CSS to speed up rendering.

### C. Component Overhead per Row

In `src/routes/(loaded)/history/match-table.svelte`:

```svelte
<Match.Root {match}>
	<TR ...>
		<Match.MapImage />
		<Match.Players />
		<!-- ... -->
	</TR>
</Match.Root>
```

- **The Problem:** `Match.Root` likely calls `createMatch(match)` (context creation). While Svelte 5 is fast, creating a new context and reactive root for every single row adds overhead.
- **Solution:** For read-only lists, consider passing the `match` object directly to the children props instead of using Context API (`useMatch`), or ensure `createMatch` is extremely lightweight.

---

## 2. Memory Management Risks

### A. Replay Parsing (High Risk)

In `src/lib/workers/replay.worker.ts`:

```ts
const { content, fileName } = data;
const replay = parseReplay(content); // <--- Full object creation
// ...
formData.append('file', new File([content], fileName)); // <--- Duplication
```

- **The Problem:**
  1.  **Double Allocation:** The `content` (Uint8Array) is passed to the worker (copied), then `parseReplay` creates a massive JS object tree (every tick, every command), then you create a `File` object.
  2.  **Retention:** If `parseReplay` returns the full command list, and you pass that back to the main thread, you are serializing/deserializing megabytes of data per replay.
- **Solution:**
  - Ensure `parseReplay` has a "header only" or "summary only" mode if you don't need the tick data for the list view.
  - Explicitly `null` out the `content` buffer in the worker when done.

### B. "Get All" Aggregation Pattern

In `src/routes/(loaded)/history/+page.svelte`:

```ts
const aggregation = resource(
    () => list.filters.scope,
    async () => {
        // Fetches EVERYTHING
        const response = await app.pocketbase
            .collection(...)
            .getFullList(...);
        // ...
    }
);
```

- **The Problem:** `getFullList` fetches **every single record** from the database to calculate stats (maps/players lists). As the user's history grows to 1,000+ matches, this will:
  1.  Freeze the UI during the fetch/process.
  2.  Consume massive RAM to hold the array of objects.
- **Solution:** Move aggregation logic to the backend (PocketBase) or use a dedicated lightweight SQL query that only returns `DISTINCT` names/maps, rather than hydrating full record objects.

---

## 3. Data Architecture & Reactivity

### A. Snapshotting Large State

In `src/routes/(loaded)/history/match-list.svelte.ts`:

```ts
capture(): MatchListState {
    return {
        filters: $state.snapshot(this.filters),
        matches: $state.snapshot(this.matches), // <--- Expensive!
        // ...
    };
}
```

- **The Problem:** `$state.snapshot` performs a deep clone. If `this.matches` contains 50-100 complex match objects, running this function (e.g., on navigation) causes a CPU spike.
- **Solution:** Only snapshot the `filters` and `page` number. When restoring, reload the data from the DB/Cache instead of keeping the stale match objects in memory.

### B. File System Reads

In `src/lib/core/app/features/replay-analyzer/analyzer.svelte.ts`:

```ts
const content = await readFile(filePath);
await this.processReplayInWorker(content, filename);
```

- **The Problem:** `readFile` loads the entire file into memory. If the user has large replays (10MB+) and the analyzer runs concurrently (you have `CONCURRENCY = 2`), this creates memory pressure.
- **Solution:** If Tauri v2 supports it, stream the file to the worker, or ensure the concurrency limit is strict.

---

## 4. Recommended Action Plan

### Immediate Fixes (Low Effort, High Impact)

1.  **Disable Tooltips in Lists:** Temporarily comment out `{@attach tooltip(...)}` in the table rows to confirm if this is the lag source. If yes, implement a delegated tooltip solution.
2.  **Fix Images:** Ensure `getFactionFlagFromRace` returns small, optimized images, or use CSS `will-change: transform` (sparingly) to help composition.
3.  **Pagination Check:** Ensure `MatchList` and `ReplayList` are strictly respecting `PAGE_SIZE` (50). 50 complex rows is still heavy; consider lowering to 20 or using **Virtualization** (e.g., `svelte-virtual-list` or `tanstack/virtual`).

### Architectural Fixes (Medium Effort)

1.  **Optimize Aggregation:** Stop using `getFullList` for filter dropdowns. Create a separate, cached list of known players/maps that updates incrementally, or query only specific fields.
2.  **Worker Optimization:** Modify `src/lib/workers/replay.worker.ts` to return a `SimplifiedReplay` object that strips out the `commands`, `ticks`, and `chat` arrays when they aren't needed for the DB record.

### Long Term

1.  **Virtual Scrolling:** For any list that can grow >100 items, virtual scrolling is mandatory to keep the DOM light.
2.  **Database Indexing:** Ensure PocketBase/SQLite has indices on `gameDate`, `mapName`, and `players` columns to keep `getPaginated` fast.
