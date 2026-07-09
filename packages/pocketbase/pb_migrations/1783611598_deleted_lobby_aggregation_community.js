/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3080897202");

  return app.delete(collection);
}, (app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json642663334",
        "maxSize": 1,
        "name": "players",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json1194199205",
        "maxSize": 1,
        "name": "maps",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json344172009",
        "maxSize": 1,
        "name": "users",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      }
    ],
    "id": "pbc_3080897202",
    "indexes": [],
    "listRule": "",
    "name": "lobby_aggregation_community",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "WITH extracted_players AS (\n  SELECT\n    CAST(json_extract(player.value, '$.profile.profile_id') AS TEXT) as profile_id,\n    json_extract(player.value, '$.profile.alias') as alias\n  FROM lobbies l, json_each(l.players) as player\n)\nSELECT\n  '1' as id,\n  (\n    SELECT\n      json_group_array(\n        json_object(\n          'profile_id', sub.profile_id,\n          'alias', sub.alias\n        )\n      )\n    FROM (\n      SELECT\n        profile_id,\n        MAX(alias) as alias\n      FROM extracted_players\n      WHERE profile_id IS NOT NULL\n      GROUP BY profile_id\n    ) as sub\n  ) as players,\n  (\n    SELECT\n      json_group_array(sub.map)\n    FROM (\n      SELECT DISTINCT map FROM lobbies WHERE map IS NOT NULL\n    ) as sub\n  ) as maps,\n  (\n    SELECT\n      json_group_array(sub.user)\n    FROM (\n      SELECT DISTINCT user FROM lobbies WHERE user IS NOT NULL\n    ) as sub\n  ) as users;",
    "viewRule": ""
  });

  return app.save(collection);
})
