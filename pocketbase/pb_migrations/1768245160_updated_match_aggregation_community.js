/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3080897202")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  p.user as id,\n  p.user,\n  p.players,\n  m.maps\nFROM\n  (\n    -- 1. Existing logic: Unique Players\n    SELECT\n      sub.user,\n      json_group_array(\n        json_object(\n          'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n          'alias', json_extract(sub.value, '$.profile.alias')\n        )\n      ) as players\n    FROM (\n      SELECT DISTINCT\n        l.user,\n        player.value\n      FROM matches l, json_each(l.players) as player\n      WHERE json_extract(player.value, '$.profile.profile_id') IS NOT NULL \n        AND json_extract(player.value, '$.profile.alias') IS NOT NULL\n    ) as sub\n    GROUP BY sub.user\n  ) as p\nLEFT JOIN\n  (\n    -- 2. New logic: Unique Maps\n    SELECT\n      sub.user,\n      json_group_array(sub.map) as maps\n    FROM (\n      SELECT DISTINCT\n        user,\n        map\n      FROM matches\n    ) as sub\n    GROUP BY sub.user\n  ) as m\nON p.user = m.user"
  }, collection)

  // remove field
  collection.fields.removeById("json344172009")

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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3080897202")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  '1' as id,\n  (\n    SELECT\n      json_group_array(\n        json_object(\n          'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n          'alias', json_extract(sub.value, '$.profile.alias')\n        )\n      )\n    FROM (\n      SELECT DISTINCT\n        player.value\n      FROM matches l, json_each(l.players) as player\n    ) as sub\n  ) as players,\n  (\n    SELECT\n      json_group_array(sub.map)\n    FROM (\n      SELECT DISTINCT\n        map\n      FROM matches\n    ) as sub\n  ) as maps,\n  (\n    SELECT\n      json_group_array(sub.user)\n    FROM (\n      SELECT DISTINCT\n        user\n      FROM matches\n    ) as sub\n  ) as users"
  }, collection)

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "json344172009",
    "maxSize": 1,
    "name": "users",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // remove field
  collection.fields.removeById("json2375276105")

  return app.save(collection)
})
