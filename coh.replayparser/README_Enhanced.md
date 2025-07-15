# Enhanced Company of Heroes 1 Replay Parser v2.0

A comprehensive, modern JavaScript/Node.js parser for Company of Heroes 1 replay files with advanced analytics, detailed action definitions, and battle intelligence.

## 🚀 What's New in v2.0

- **🔍 400+ Comprehensive Action Definitions** - Complete coverage of all CoH1 units, abilities, and commands
- **🧠 Advanced Battle Analytics** - Player performance metrics, battle rhythm analysis, and strategic insights
- **🗺️ Map Intelligence** - Combat hotspots, movement patterns, and territorial control analysis
- **📊 Enhanced Statistics** - APM tracking, efficiency metrics, and playstyle detection
- **⚡ Performance Optimizations** - Memory-efficient streaming for large files
- **📱 Modern Architecture** - ES6+ modules, async/await, and comprehensive error handling
- **📈 Export Formats** - JSON, CSV, and beautiful HTML reports with visualizations

## ✨ Key Features

### Comprehensive Action Parsing

- **Complete Action Coverage**: 400+ action definitions covering all CoH1 content
- **Detailed Categorization**: Combat, Movement, Production, Resource, Abilities, and more
- **Enhanced Coordinates**: Precise location tracking with distance calculations
- **Parameter Extraction**: Detailed action parameters for advanced analysis

### Advanced Analytics

- **Player Performance**: APM, efficiency, playstyle detection (Aggressive/Economic/Balanced)
- **Battle Intelligence**: Critical moments, engagement analysis, winner prediction
- **Timeline Analysis**: Game phases, peak activity detection, trend analysis
- **Combat Analysis**: Hotspot detection, weapon usage statistics, engagement duration

### Modern Architecture

- **Streaming Support**: Memory-efficient processing for large replay files
- **Progress Tracking**: Real-time progress callbacks for long operations
- **Error Resilience**: Comprehensive error handling and graceful degradation
- **Modular Design**: Clean, maintainable code with ES6+ features

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/enhanced-coh-replay-parser.git
cd enhanced-coh-replay-parser

# Install dependencies (Node.js built-ins only)
npm install

# Run tests
npm test
```

## 🎮 Quick Start

### Basic Usage

```javascript
import CoHReplayAnalyzer from './EnhancedCoHReplayAnalyzer.js';

const analyzer = new CoHReplayAnalyzer();

// Quick header information
const info = await analyzer.getReplayInfo('replay.rec');
console.log('Map:', info.info.mapName);
console.log('Players:', info.info.playerCount);

// Full analysis with all features
const result = await analyzer.analyzeReplay('replay.rec', {
	generateStatistics: true,
	generateHeatmap: true,
	exportFormats: ['json', 'html'],
	progressCallback: (progress) => console.log(`Progress: ${progress}%`)
});

if (result.success) {
	console.log('Analysis completed!');
	console.log('Winner:', result.analysis.summary.gameOutcome);
	console.log('MVP:', result.analysis.summary.mvpPlayer);
	console.log('Average APM:', result.analysis.battle.averageAPM);
}
```

### Command Line Interface

```bash
# Basic analysis
node EnhancedCoHReplayAnalyzer.js replay.rec

# Header information only
node EnhancedCoHReplayAnalyzer.js replay.rec --header-only

# Full analysis with exports
node EnhancedCoHReplayAnalyzer.js replay.rec --export-html --export-json

# Streaming mode for large files
node EnhancedCoHReplayAnalyzer.js replay.rec --streaming --max-memory 512
```

## 📊 Analysis Output

### Player Analysis

```javascript
{
  name: "PlayerName",
  faction: "american",
  statistics: {
    apm: 67.5,
    totalActions: 2847,
    combatActions: 892,
    buildActions: 445,
    resourceActions: 234
  },
  performance: {
    actionEfficiency: 0.87,
    apmCategory: "Intermediate",
    playstyle: "Balanced"
  }
}
```

### Battle Analytics

```javascript
{
  totalActions: 12489,
  averageAPM: 72.3,
  peakAPM: 145.8,
  combatIntensity: 0.31,
  gamePhases: [
    { phase: "Early Game", startTime: 0, averageAPM: 45.2 },
    { phase: "Mid Game", startTime: 300000, averageAPM: 89.7 },
    { phase: "Late Game", startTime: 900000, averageAPM: 62.1 }
  ],
  criticalMoments: [
    {
      timeStamp: "12:34",
      type: "Major Combat",
      description: "Intense battle with 67 combat actions"
    }
  ]
}
```

### Combat Intelligence

```javascript
{
  combatHotspots: [
    { x: 450, y: 320, combatActions: 89 },
    { x: 123, y: 567, combatActions: 67 }
  ],
  weaponUsage: [
    { weapon: "Tank Main Gun", usage: 156 },
    { weapon: "Machine Gun Burst", usage: 134 }
  ],
  engagements: [
    {
      startTime: "08:45",
      duration: 47,
      actions: 89,
      participants: 4
    }
  ]
}
```

## 🗺️ Map Analysis

The parser provides detailed map analysis including:

- **Combat Hotspots**: Areas with highest combat activity
- **Movement Patterns**: Player movement and positioning analysis
- **Territorial Control**: Resource point capture analysis
- **Activity Heatmap**: Visual representation of game activity

## 📈 Export Formats

### JSON Export

Complete analysis data in structured JSON format for further processing.

### CSV Export

Player statistics in CSV format for spreadsheet analysis.

### HTML Report

Beautiful, interactive HTML reports with:

- Player performance summaries
- Battle timeline visualization
- Critical moments analysis
- Strategic recommendations

## ⚙️ Configuration Options

```javascript
const options = {
	// Parsing options
	headerOnly: false, // Parse header only
	streamingMode: false, // Use streaming for large files
	maxMemoryMB: 1024, // Memory limit for streaming

	// Analysis options
	generateStatistics: true, // Generate player statistics
	generateHeatmap: true, // Generate activity heatmap
	generateTimeline: true, // Generate timeline analysis
	detailedAnalysis: true, // Include detailed battle analysis

	// Export options
	exportFormats: ['json', 'html'], // Export formats

	// Callbacks
	progressCallback: (progress) => console.log(`${progress}%`)
};
```

## 🔧 Advanced Features

### Streaming Mode

For large replay files (>100MB), use streaming mode to process data efficiently:

```javascript
const result = await analyzer.analyzeReplay('large-replay.rec', {
	streamingMode: true,
	maxMemoryMB: 512
});
```

### Custom Action Definitions

Provide your own action definitions file:

```javascript
const result = await analyzer.analyzeReplay('replay.rec', {
	actionDefinitionsPath: './custom_actions.txt'
});
```

### Battle Intelligence

Get strategic insights and recommendations:

```javascript
const analysis = result.analysis;
console.log('Game Style:', analysis.summary.gameStyle);
console.log('Recommendations:', analysis.summary.recommendations);
```

## 📋 Action Definitions Format

The parser includes comprehensive action definitions in the format:

```
ActionType;ActionID;"ActionDescription";HasLocation
```

Example:

```
1;1;"Move Unit";1
2;5;"Call in Airstrike";1
3;200;"Train Riflemen";0
4;1;"Infantry Doctrine";0
```

## 🎯 Performance Benchmarks

- **Small replays (<10MB)**: ~2-5 seconds
- **Medium replays (10-50MB)**: ~10-30 seconds
- **Large replays (50-200MB)**: ~1-5 minutes
- **Memory usage**: 256MB - 2GB depending on file size and options

## 🔍 Troubleshooting

### Memory Issues

For large files, use streaming mode or increase memory allocation:

```bash
node --max-old-space-size=8192 EnhancedCoHReplayAnalyzer.js replay.rec --streaming
```

### Parsing Errors

The parser includes comprehensive error handling. Check the error messages for specific issues:

- File format validation
- Corrupted replay detection
- Memory constraint warnings

### Performance Optimization

- Use `--header-only` for quick metadata extraction
- Enable streaming mode for files >50MB
- Reduce `maxMemoryMB` if experiencing memory issues

## 🏗️ Architecture

The enhanced parser consists of several key components:

- **EnhancedReplayParser**: Core parsing engine with streaming support
- **CoHReplayAnalyzer**: High-level analysis and export functionality
- **ActionDefinitions**: Comprehensive action definition management
- **BattleStatistics**: Advanced analytics and intelligence
- **ReplayStream**: Optimized binary file reading

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for:

- Additional action definitions
- New analysis features
- Performance improvements
- Bug fixes

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original CoH replay format research by the community
- Relic Entertainment for Company of Heroes
- Contributors to the open-source CoH modding community

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-repo/enhanced-coh-replay-parser/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-repo/enhanced-coh-replay-parser/discussions)
- 📧 **Email**: support@enhanced-coh-parser.com

---

⭐ **Star this repository if you find it useful!** ⭐
