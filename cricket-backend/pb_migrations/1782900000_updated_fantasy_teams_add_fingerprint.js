/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("fantasy_teams");

  unmarshal({
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
        "minSelect": 11,
        "maxSelect": 11
      },
      {
        "id": "relation_captain",
        "name": "captain",
        "type": "relation",
        "system": false,
        "required": false,
        "presentable": false,
        "collectionId": "pbc_3072146508",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1
      },
      {
        "id": "relation_vice_captain",
        "name": "vice_captain",
        "type": "relation",
        "system": false,
        "required": false,
        "presentable": false,
        "collectionId": "pbc_3072146508",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1
      },
      {
        "id": "text_fingerprint",
        "name": "fingerprint",
        "type": "text",
        "system": false,
        "required": false,
        "presentable": false
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
  }, collection);

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("fantasy_teams");

  unmarshal({
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
        "minSelect": 11,
        "maxSelect": 11
      },
      {
        "id": "relation_captain",
        "name": "captain",
        "type": "relation",
        "system": false,
        "required": false,
        "presentable": false,
        "collectionId": "pbc_3072146508",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1
      },
      {
        "id": "relation_vice_captain",
        "name": "vice_captain",
        "type": "relation",
        "system": false,
        "required": false,
        "presentable": false,
        "collectionId": "pbc_3072146508",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1
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
  }, collection);

  return app.save(collection);
})
