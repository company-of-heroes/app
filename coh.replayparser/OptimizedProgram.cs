using System;
using CoH;

namespace CoHReplayParser
{
    class OptimizedProgram
    {
        static void Main(string[] args)
        {
            Console.WriteLine("CoH Replay Parser - Optimized C# Test");
            Console.WriteLine("=====================================");

            try
            {
                // Memory monitoring
                long initialMemory = GC.GetTotalMemory(false);
                Console.WriteLine($"Initial memory usage: {initialMemory / 1024 / 1024:F2} MB");

                // Test basic instantiation
                Console.WriteLine("✓ Testing basic class instantiation...");
                
                string replayPath = @"4p_rails and metal.2024-01-27.22-15-48.rec";
                string actionDefsPath = @"actiondefinitions.txt"; // Optional
                
                if (System.IO.File.Exists(replayPath))
                {
                    Console.WriteLine($"✓ Found replay file: {replayPath}");
                    var fileInfo = new System.IO.FileInfo(replayPath);
                    Console.WriteLine($"  File size: {fileInfo.Length / 1024 / 1024:F2} MB");
                    
                    // Test ActionDefinitions (optional)
                    CoH.ActionDefinitions actionDefs = null;
                    if (System.IO.File.Exists(actionDefsPath))
                    {
                        Console.WriteLine($"✓ Found action definitions: {actionDefsPath}");
                        actionDefs = new CoH.ActionDefinitions(actionDefsPath);
                    }
                    else
                    {
                        Console.WriteLine($"! Action definitions file not found: {actionDefsPath}");
                        Console.WriteLine("  (This is optional - continuing without action definitions)");
                    }
                    
                    // Test header-only parsing first (safe)
                    Console.WriteLine("✓ Creating Replay object for header parsing...");
                    CoH.Replay replay = new CoH.Replay(replayPath, actionDefs);
                    
                    long afterReplayCreation = GC.GetTotalMemory(true);
                    Console.WriteLine($"Memory after replay creation: {afterReplayCreation / 1024 / 1024:F2} MB");
                    
                    Console.WriteLine($"  File Name: {replay.fileName}");
                    Console.WriteLine($"  MD5 Hash: {replay.MD5Hash}");
                    
                    // Test ReplayParser - HEADER ONLY
                    Console.WriteLine("✓ Testing ReplayParser (header only)...");
                    CoH.ReplayParser parser = new CoH.ReplayParser();
                    
                    Console.WriteLine("✓ Parsing header...");
                    CoH.Replay parsedReplay = parser.parse(replay, true); // true = header only
                    
                    long afterHeaderParsing = GC.GetTotalMemory(true);
                    Console.WriteLine($"Memory after header parsing: {afterHeaderParsing / 1024 / 1024:F2} MB");
                    
                    Console.WriteLine($"  Replay Version: {parsedReplay.replayVersion}");
                    Console.WriteLine($"  Game Type: {parsedReplay.gameType}");
                    Console.WriteLine($"  Game Date: {parsedReplay.gameDate}");
                    Console.WriteLine($"  Map Name: {parsedReplay.mapName}");
                    Console.WriteLine($"  Map Size: {parsedReplay.mapWidth}x{parsedReplay.mapHeight}");
                    Console.WriteLine($"  Player Count: {parsedReplay.playerCount}");
                    
                    Console.WriteLine("\n⚠️  WARNING: Full replay parsing can consume massive amounts of memory!");
                    Console.WriteLine($"   Current file size: {fileInfo.Length / 1024 / 1024:F2} MB");
                    Console.WriteLine("   This could use several GB of RAM. Continue? (y/N)");
                    
                    string input = Console.ReadLine();
                    if (input?.ToLower() == "y")
                    {
                        Console.WriteLine("✓ Starting full replay parsing with memory monitoring...");
                        
                        // Monitor memory during parsing
                        var memoryTimer = new System.Timers.Timer(2000); // Check every 2 seconds
                        memoryTimer.Elapsed += (sender, e) => {
                            long currentMemory = GC.GetTotalMemory(false);
                            Console.WriteLine($"  Current memory usage: {currentMemory / 1024 / 1024:F2} MB");
                            
                            // Safety check - abort if memory exceeds 4GB
                            if (currentMemory > 4L * 1024 * 1024 * 1024)
                            {
                                Console.WriteLine("🚨 MEMORY LIMIT EXCEEDED (4GB)! Aborting parsing...");
                                Environment.Exit(1);
                            }
                        };
                        memoryTimer.Start();
                        
                        try
                        {
                            // Create a fresh replay object for full parsing
                            CoH.Replay fullReplay = new CoH.Replay(replayPath, actionDefs);
                            CoH.ReplayParser fullParser = new CoH.ReplayParser();
                            
                            // Parse with memory monitoring
                            Console.WriteLine("  Parsing in progress...");
                            CoH.Replay result = fullParser.parse(fullReplay, false); // false = full parsing
                            
                            memoryTimer.Stop();
                            
                            long finalMemory = GC.GetTotalMemory(true);
                            Console.WriteLine($"Final memory usage: {finalMemory / 1024 / 1024:F2} MB");
                            
                            Console.WriteLine($"✓ Full replay parsing completed!");
                            Console.WriteLine($"  Total Players: {result.playerCount}");
                            Console.WriteLine($"  Total Messages: {result.messageCount}");
                            Console.WriteLine($"  Total Actions: {result.actionCount}");
                            
                            // Show some players
                            Console.WriteLine("\nPlayers:");
                            foreach (CoH.Replay.Player player in result.players)
                            {
                                Console.WriteLine($"  - {player.name} ({player.faction}) [ID: {player.id}]");
                            }
                            
                            // Show some recent messages (limit to avoid memory issues)
                            Console.WriteLine($"\nLast 5 chat messages (out of {result.messageCount}):");
                            var messageList = new List<CoH.Replay.Message>(result.messages);
                            for (int i = Math.Max(0, messageList.Count - 5); i < messageList.Count; i++)
                            {
                                var msg = messageList[i];
                                Console.WriteLine($"  [{msg.timeStamp}] {msg.playerName}: {msg.text}");
                            }
                        }
                        catch (OutOfMemoryException)
                        {
                            memoryTimer.Stop();
                            Console.WriteLine("🚨 OUT OF MEMORY EXCEPTION!");
                            Console.WriteLine("   The replay file is too large for available memory.");
                            Console.WriteLine("   Consider using the Node.js version or implementing streaming parsing.");
                        }
                    }
                    else
                    {
                        Console.WriteLine("✓ Skipping full parsing - staying with header-only results.");
                    }
                }
                else
                {
                    Console.WriteLine($"✗ Replay file not found: {replayPath}");
                    Console.WriteLine("  Please make sure you have a .rec file in the project directory.");
                }
                
                Console.WriteLine("\n✓ Test completed!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n✗ Error occurred: {ex.Message}");
                Console.WriteLine($"Type: {ex.GetType().Name}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
                }
            }
            
            long endMemory = GC.GetTotalMemory(true);
            Console.WriteLine($"Final memory usage: {endMemory / 1024 / 1024:F2} MB");
            
            Console.WriteLine("\nPress any key to exit...");
            Console.ReadKey();
        }
    }
}
