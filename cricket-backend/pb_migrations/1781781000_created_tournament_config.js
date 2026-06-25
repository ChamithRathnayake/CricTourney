/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_tourn_config_12345",
    "name": "tournament_config",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "fields": [
      {
        "id": "text_id",
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
        "id": "relation_mos",
        "name": "man_of_the_series",
        "type": "relation",
        "system": false,
        "required": false,
        "presentable": false,
        "collectionId": "pbc_3072146508",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": null
      },
      {
        "id": "text_mos_performance",
        "name": "mos_performance",
        "type": "text",
        "system": false,
        "required": false,
        "presentable": false
      },
      {
        "id": "autodate_created",
        "name": "created",
        "type": "autodate",
        "system": false,
        "onCreate": true,
        "onUpdate": false,
        "presentable": false
      },
      {
        "id": "autodate_updated",
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
  const collection = app.findCollectionByNameOrId("pbc_tourn_config_12345");

  return app.delete(collection);
})
