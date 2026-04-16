/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_908767333")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_8p4C4GmHxi` ON `lobbies_live` (`user`)",
      "CREATE INDEX `idx_U7Dm80Lyix` ON `lobbies_live` (\n  `map`,\n  `sessionId`\n)",
      "CREATE UNIQUE INDEX `idx_ufN7vdqOgf` ON `lobbies_live` (`sessionId`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("text724990059")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_908767333")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_8p4C4GmHxi` ON `lobbies_live` (`user`)",
      "CREATE INDEX `idx_U7Dm80Lyix` ON `lobbies_live` (\n  `title`,\n  `map`,\n  `sessionId`\n)",
      "CREATE UNIQUE INDEX `idx_ufN7vdqOgf` ON `lobbies_live` (`sessionId`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text724990059",
    "max": 0,
    "min": 0,
    "name": "title",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
