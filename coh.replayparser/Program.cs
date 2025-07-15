using System;
using CoH;

namespace CoHReplayParser
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("CoH Replay Parser - C# Test");
            Console.WriteLine("============================");

            try
            {
                // Test basic instantiation
                Console.WriteLine("✓ Testing basic class instantiation...");
                
                // Test with a sample replay file (you'll need to adjust the path)
                string replayPath = @"4p_rails and metal.2024-01-27.22-15-48.rec";
                string actionDefsPath = @"actiondefinitions.txt"; // Optional
                
                if (System.IO.File.Exists(replayPath))
                {
                    Console.WriteLine($"✓ Found replay file: {replayPath}");
                    
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
                    
                    // Test Replay instantiation
                    Console.WriteLine("✓ Creating Replay object...");
                    CoH.Replay replay = new CoH.Replay(replayPath, actionDefs);
                    
                    Console.WriteLine($"  File Name: {replay.fileName}");
                    Console.WriteLine($"  MD5 Hash: {replay.MD5Hash}");
                    
                    // Test ReplayParser
                    Console.WriteLine("✓ Testing ReplayParser...");
                    CoH.ReplayParser parser = new CoH.ReplayParser();
                    
                    // Parse header only first
                    Console.WriteLine("✓ Parsing header...");
                    CoH.Replay parsedReplay = parser.parse(replay, true); // true = header only
                    
                    Console.WriteLine($"  Replay Version: {parsedReplay.replayVersion}");
                    Console.WriteLine($"  Game Type: {parsedReplay.gameType}");
                    Console.WriteLine($"  Game Date: {parsedReplay.gameDate}");
                    Console.WriteLine($"  Map Name: {parsedReplay.mapName}");
                    Console.WriteLine($"  Map Size: {parsedReplay.mapWidth}x{parsedReplay.mapHeight}");
                    Console.WriteLine($"  Player Count: {parsedReplay.playerCount}");
                    
                    // Optionally parse full replay (this might take time)
                    Console.WriteLine("\nDo you want to parse the full replay? (y/N)");
                    string input = Console.ReadLine();
                    if (input?.ToLower() == "y")
                    {
                        Console.WriteLine("✓ Parsing full replay (this may take a while)...");
                        CoH.Replay fullReplay = parser.parse(replayPath, actionDefs);
                        
                        Console.WriteLine($"  Total Players: {fullReplay.playerCount}");
                        Console.WriteLine($"  Total Messages: {fullReplay.messageCount}");
                        Console.WriteLine($"  Total Actions: {fullReplay.actionCount}");
                        
                        // Show some players
                        Console.WriteLine("\nPlayers:");
                        foreach (CoH.Replay.Player player in fullReplay.players)
                        {
                            Console.WriteLine($"  - {player.name} ({player.faction}) [ID: {player.id}]");
                        }
                        
                        // Show some recent messages
                        Console.WriteLine("\nLast 5 chat messages:");
                        var messageList = new List<CoH.Replay.Message>(fullReplay.messages);
                        for (int i = Math.Max(0, messageList.Count - 5); i < messageList.Count; i++)
                        {
                            var msg = messageList[i];
                            Console.WriteLine($"  [{msg.timeStamp}] {msg.playerName}: {msg.text}");
                        }
                    }
                }
                else
                {
                    Console.WriteLine($"✗ Replay file not found: {replayPath}");
                    Console.WriteLine("  Please make sure you have a .rec file in the project directory.");
                    
                    // Test basic object creation without file
                    Console.WriteLine("✓ Testing basic object creation without files...");
                    
                    // Create empty replay for testing
                    var testReplay = new CoH.Replay();
                    Console.WriteLine($"✓ Empty Replay created");
                    Console.WriteLine($"  Player Count: {testReplay.playerCount}");
                    Console.WriteLine($"  Message Count: {testReplay.messageCount}");
                    Console.WriteLine($"  Action Count: {testReplay.actionCount}");
                }
                
                Console.WriteLine("\n✓ All tests completed successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n✗ Error occurred: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
            }
            
            Console.WriteLine("\nPress any key to exit...");
            Console.ReadKey();
        }
    }
}
