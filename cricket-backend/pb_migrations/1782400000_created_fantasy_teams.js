/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_fantasy_teams",
    "name": "fantasy_teams",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": null,
    "indexes": [],
    "fields": [
      {
        "id": "text3208210256",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "presentable": false,
        "primaryKey": true,
        "autogeneratePattern": "[a-z0-9]{15}",
        "pattern": "^[a-z0-9]+$"
      },
      {
        "id": "text_name",
        "name": "name",
        "type": "text",
        "system": false,
        "required": true,
        "presentable": true
      },
      {
        "id": "text_owner_name",
        "name": "owner_name",
        "type": "text",
        "system": false,
        "required": true,
        "presentable": false
      },
      {
        "id": "relation_players",
        "name": "players",
        "type": "relation",
        "system": false,
        "required": true,
        "presentable": false,
        "collectionId": "pbc_3072146508",
        "cascadeDelete": false,
        "minSelect": 5,
        "maxSelect": 5
      },
      {
        "id": "autodate2990389176",
        "name": "created",
        "type": "autodate",
        "system": false,
        "onCreate": true,
        "onUpdate": false,
        "presentable": false
      },
      {
        "id": "autodate3332085495",
        "name": "updated",
        "type": "autodate",
        "system": false,
        "onCreate": true,
        "onUpdate": true,
        "presentable": false
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_teams");

  return app.delete(collection);
});
