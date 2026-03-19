/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT u.USER AS id,\n       u.USER,\n\n  (SELECT Json_group_array(Json_object('profile_id', Json_extract(sub.value, '$.profile.profile_id') , 'alias', Json_extract(sub.value, '$.profile.alias')))\n   FROM\n     (SELECT DISTINCT player.value AS value\n      FROM lobbies l,\n           Json_each(l.players) AS player\n      WHERE l.USER = u.USER\n        AND Json_extract(player.value, '$.profile.profile_id') IS NOT\n                           NULL) sub) AS players,\n\n  (SELECT Json_group_array(map_sub.map)\n   FROM\n     (SELECT DISTINCT map\n      FROM lobbies\n      WHERE USER = u.USER\n        AND map IS NOT NULL) map_sub) AS maps\nFROM\n  (SELECT DISTINCT USER\n   FROM lobbies\n   WHERE USER IS NOT NULL) u"
  }, collection)

  // remove field
  collection.fields.removeById("json2375276105")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "json3137747965",
    "maxSize": 1,
    "name": "USER",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\nu.user AS id,\nu.user,\n(\nSELECT json_group_array(\njson_object(\n'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n'alias', json_extract(sub.value, '$.profile.alias')\n)\n)\nFROM (\nSELECT DISTINCT player.value AS value\nFROM lobbies l, json_each(l.players) AS player\nWHERE l.user = u.user\nAND json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n) sub\n) AS players,\n(\nSELECT json_group_array(map_sub.map)\nFROM (\nSELECT DISTINCT map\nFROM lobbies\nWHERE user = u.user AND map IS NOT NULL\n) map_sub\n) AS maps\nFROM (\nSELECT DISTINCT user\nFROM lobbies\nWHERE user IS NOT NULL\n) u"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "json2375276105",
    "maxSize": 1,
    "name": "user",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // remove field
  collection.fields.removeById("json3137747965")

  return app.save(collection)
})
