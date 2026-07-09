/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174");

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
        "id": "json3137747965",
        "maxSize": 1,
        "name": "USER",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
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
      }
    ],
    "id": "pbc_1750043174",
    "indexes": [],
    "listRule": "",
    "name": "lobby_aggregation",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT u.USER AS id,\n       u.USER,\n\n  (SELECT Json_group_array(Json_object('profile_id', Json_extract(sub.value, '$.profile.profile_id') , 'alias', Json_extract(sub.value, '$.profile.alias')))\n   FROM\n     (SELECT DISTINCT player.value AS value\n      FROM lobbies l,\n           Json_each(l.players) AS player\n      WHERE l.USER = u.USER\n        AND Json_extract(player.value, '$.profile.profile_id') IS NOT\n                           NULL) sub) AS players,\n\n  (SELECT Json_group_array(map_sub.map)\n   FROM\n     (SELECT DISTINCT map\n      FROM lobbies\n      WHERE USER = u.USER\n        AND map IS NOT NULL) map_sub) AS maps\nFROM\n  (SELECT DISTINCT USER\n   FROM lobbies\n   WHERE USER IS NOT NULL) u",
    "viewRule": ""
  });

  return app.save(collection);
})
