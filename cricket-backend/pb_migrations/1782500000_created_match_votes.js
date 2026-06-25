/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_match_votes",
    "name": "match_votes",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": null,
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
        "id": "relation_match",
        "name": "match",
        "type": "relation",
        "system": false,
        "required": true,
        "presentable": false,
        "collectionId": "pbc_2541054544",
        "cascadeDelete": true,
        "minSelect": 0,
        "maxSelect": 1
      },
      {
        "id": "relation_team",
        "name": "team",
        "type": "relation",
        "system": false,
        "required": true,
        "presentable": false,
        "collectionId": "pbc_1568971955",
        "cascadeDelete": true,
        "minSelect": 0,
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
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_match_votes");

  return app.delete(collection);
});
