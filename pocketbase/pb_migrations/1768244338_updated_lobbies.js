/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1574334436")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_8b5JbSpePY` ON `matches` (\n  `title`,\n  `map`\n)"
    ],
    "name": "matches"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1574334436")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_8b5JbSpePY` ON `lobbies` (\n  `title`,\n  `map`\n)"
    ],
    "name": "lobbies"
  }, collection)

  return app.save(collection)
})
