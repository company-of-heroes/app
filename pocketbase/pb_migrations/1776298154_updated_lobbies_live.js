/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
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
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "bool1597818652",
    "name": "isRanked",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number961590774",
    "max": null,
    "min": null,
    "name": "sessionId",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

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

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2477632187",
    "max": 0,
    "min": 0,
    "name": "map",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "json3437516279",
    "maxSize": 0,
    "name": "players",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "json"
  }))

  // update field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "autodate2990389176",
    "name": "createdAt",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "autodate3332085495",
    "name": "updatedAt",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_908767333")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_8p4C4GmHxi` ON `lobbies_live` (`user`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("bool1597818652")

  // remove field
  collection.fields.removeById("number961590774")

  // remove field
  collection.fields.removeById("text724990059")

  // remove field
  collection.fields.removeById("text2477632187")

  // update field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "json3437516279",
    "maxSize": 10485760,
    "name": "lobby",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "json"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "autodate2990389176",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "autodate3332085495",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
})
