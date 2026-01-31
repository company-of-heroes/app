/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_673294823")

  // update field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_1574334436",
    "hidden": false,
    "id": "relation3437516279",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "lobby",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_533777971",
    "hidden": false,
    "id": "relation2490651244",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "comment",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_673294823")

  // update field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1574334436",
    "hidden": false,
    "id": "relation3437516279",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "lobby",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_533777971",
    "hidden": false,
    "id": "relation2490651244",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "comment",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
