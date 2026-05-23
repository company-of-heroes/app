/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1574334436")

  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_8b5JbSpePY` ON `lobbies` (\n  `title`,\n  `map`\n)",
      "CREATE INDEX `idx_lobbies_user_map_agg` ON `lobbies` (`user`, `map`)",
      "CREATE INDEX `idx_lobbies_user_players_agg` ON `lobbies` (`user`, `players`)",
      "CREATE INDEX `idx_lobbies_players_agg` ON `lobbies` (`players`)",
      "CREATE INDEX `idx_lobbies_map_agg` ON `lobbies` (`map`)",
      "CREATE INDEX `idx_lobbies_createdAt` ON `lobbies` (`createdAt`)",
      "CREATE INDEX `idx_lobbies_user_createdAt` ON `lobbies` (`user`, `createdAt`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1574334436")

  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_8b5JbSpePY` ON `lobbies` (\n  `title`,\n  `map`\n)",
      "CREATE INDEX `idx_lobbies_user_map_agg` ON `lobbies` (`user`, `map`)",
      "CREATE INDEX `idx_lobbies_user_players_agg` ON `lobbies` (`user`, `players`)",
      "CREATE INDEX `idx_lobbies_players_agg` ON `lobbies` (`players`)",
      "CREATE INDEX `idx_lobbies_map_agg` ON `lobbies` (`map`)"
    ]
  }, collection)

  return app.save(collection)
})
