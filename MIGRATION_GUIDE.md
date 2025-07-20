# Simplified Replay Parser Migration Guide

The new simplified replay parser provides the same functionality as the complex class-based parser but with a much cleaner, functional API.

## New API Usage

### Direct parsing from Uint8Array (your requested function):

```typescript
import { parseReplay } from '$lib/core/replay-analyzer';

// Parse replay from Uint8Array
const replayData: Uint8Array = /* your replay file data */;
const parsedReplay = parseReplay(replayData, 'filename.rec');

console.log(parsedReplay.players);
console.log(parsedReplay.messages);
console.log(parsedReplay.actions);
```

### File-based parsing (maintains compatibility):

```typescript
import { parseReplayFile } from '$lib/core/replay-analyzer';

// Parse replay from file path
const parsedReplay = await parseReplayFile('/path/to/replay.rec');

// Header only (for performance)
const headerOnly = await parseReplayFile('/path/to/replay.rec', true);
```

## Migration Examples

### Before (Complex):

```typescript
import ReplayParser from '$lib/core/replay-analyzer/replay-parser';

const replay = await ReplayParser.parse(`${this.path}/${file.name}`);
console.log(replay.players.length);
console.log(replay.messages.length);
console.log(replay.duration);
```

### After (Simple):

```typescript
import { parseReplayFile } from '$lib/core/replay-analyzer';

const replay = await parseReplayFile(`${this.path}/${file.name}`);
console.log(replay.playerCount);
console.log(replay.messageCount);
console.log(replay.duration);
```

## Key Benefits

1. **Single function call** - No more complex class instantiation
2. **Direct Uint8Array support** - As requested, you can now pass raw data
3. **Same data structure** - All the same properties and information
4. **Much simpler code** - ~500 lines vs ~1500+ lines
5. **Better error handling** - Clearer error messages and validation
6. **Backward compatible** - Can still use file paths if needed

## Data Structure Comparison

The new `ParsedReplay` interface provides all the same data:

```typescript
interface ParsedReplay {
	// Header info
	fileName: string;
	replayVersion: number;
	gameDate: Date;
	mapName: string;
	replayName: string;
	matchType: string;
	duration: number;
	// ... all other properties

	// Players, messages, actions
	players: Player[];
	messages: Message[];
	actions: Action[];

	// Computed counts
	playerCount: number;
	messageCount: number;
	actionCount: number;
}
```

## Performance

- **Faster parsing** - Simplified logic with fewer object allocations
- **Memory efficient** - Single pass parsing, no intermediate objects
- **Header-only mode** - Skip actions/messages for quick metadata parsing

## Error Handling

The new parser has better error handling with descriptive messages:

```typescript
try {
	const replay = parseReplay(replayData);
} catch (error) {
	console.error('Replay parsing failed:', error.message);
}
```

Common errors are caught and handled gracefully, with the parser continuing when possible.
