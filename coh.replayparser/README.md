# CoH Replay Parser for Node.js

A JavaScript/Node.js port of the Company of Heroes replay parser, converted from the original C# implementation.

## Features

- Parse Company of Heroes replay files (.rec)
- Extract replay metadata (map info, players, game settings)
- Parse game actions and chat messages
- Support for action definitions
- Export data to JSON or text formats
- Header-only parsing for quick metadata extraction

## Installation

```bash
npm install
```

## Usage

### Basic Usage

```javascript
import CoHReplayParser from './index.js';

const parser = new CoHReplayParser();

// Parse full replay with action definitions
const result = parser.parseReplay('replay.rec', 'actiondefinitions.txt');

if (result.success) {
	console.log('Replay Summary:', result.summary);
	console.log('Players:', result.summary.players);
	console.log('Duration:', result.summary.duration);
} else {
	console.error('Error:', result.error);
}
```

### Header-Only Parsing

For faster parsing when you only need metadata:

```javascript
const headerResult = parser.parseHeaderOnly('replay.rec');

if (headerResult.success) {
	console.log('Map Name:', headerResult.header.mapName);
	console.log('Player Count:', headerResult.header.playerCount);
	console.log('Game Date:', headerResult.header.gameDate);
}
```

### Export Functions

```javascript
// Export to JSON (async)
await parser.exportToJSON(result.replay, 'replay_data.json');

// Export chat messages to text (async)
await parser.exportMessagesToText(result.replay, 'chat_log.txt');
```

### Working with Action Definitions

```javascript
import { ActionDefinitions } from './ActionDefinitions.js';

const actionDefs = new ActionDefinitions('actiondefinitions.txt');
console.log('Action text:', actionDefs.getActionText(1, 100));
console.log('Has location:', actionDefs.getActionHasLocation(1, 100));
```

## API Reference

### CoHReplayParser

#### `parseReplay(replayFilePath, actionDefinitionsPath)`

- Parses a complete replay file
- Returns object with `success`, `replay`, and `summary` properties

#### `parseHeaderOnly(replayFilePath, actionDefinitionsPath)`

- Parses only the replay header for quick metadata extraction
- Returns object with `success` and `header` properties

#### `exportToJSON(replay, filePath)` (async)

- Exports replay data to JSON format

#### `exportMessagesToText(replay, filePath)` (async)

- Exports chat messages to text format

### Replay Object Structure

```javascript
{
    fileName: string,
    gameDate: Date,
    mapName: string,
    players: Array<Player>,
    messages: Array<Message>,
    actions: Array<Action>,
    // ... other properties
}
```

### Player Object

```javascript
{
    name: string,
    faction: string,
    id: number,
    doctrine: number
}
```

### Message Object

```javascript
{
    tick: number,
    timeStamp: string,
    playerName: string,
    playerID: number,
    text: string,
    recipient: number
}
```

### Action Object

```javascript
{
    tick: number,
    timeStamp: string,
    actionType: number,
    action: number,
    playerID: number,
    coordinate1: Coordinate,
    coordinate2: Coordinate,
    // ... other properties
}
```

## File Structure

- `index.js` - Main entry point and CoHReplayParser class
- `ReplayParser.js` - Core parsing logic
- `Replay.js` - Replay, Player, Message, Action classes
- `ActionDefinitions.js` - Action definitions handling
- `ReplayStream.js` - Binary file reading utilities
- `test.js` - Test suite and usage examples

## Testing

```bash
npm test
```

Or run directly:

```bash
node test.js
```

## Differences from C# Version

- Uses Node.js Buffer instead of byte arrays
- Replaced C# DataSet with plain JavaScript objects
- Used JavaScript Map/Set instead of Dictionary
- Implemented iterators using generator functions
- Error handling uses try/catch instead of C# exceptions

## Requirements

- Node.js 12+ (for Buffer methods)
- No external dependencies beyond Node.js built-ins

## License

ISC

## Contributing

Feel free to submit issues and pull requests for improvements or bug fixes.
