/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const playersCollection = app.findCollectionByNameOrId("pbc_3072146508");
  unmarshal({
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1568971955",
        "help": "",
        "hidden": false,
        "id": "relation3303056927",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "team",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select1466534506",
        "maxSelect": 1,
        "name": "role",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "Batter",
          "Bawler",
          "All-Rounder",
          "Wicket Keeper"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "file3834550804",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": null,
        "name": "photo",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_epf_number",
        "max": 0,
        "min": 0,
        "name": "epf_number",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ]
  }, playersCollection);
  app.save(playersCollection);

  const configCollection = app.findCollectionByNameOrId("pbc_tourn_config_12345");
  unmarshal({
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
        "id": "bool_show_epf_number",
        "name": "show_epf_number",
        "type": "bool",
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
  }, configCollection);
  app.save(configCollection);
}, (app) => {
  const playersCollection = app.findCollectionByNameOrId("pbc_3072146508");
  unmarshal({
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1568971955",
        "help": "",
        "hidden": false,
        "id": "relation3303056927",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "team",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select1466534506",
        "maxSelect": 1,
        "name": "role",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "Batter",
          "Bawler",
          "All-Rounder",
          "Wicket Keeper"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "file3834550804",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": null,
        "name": "photo",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ]
  }, playersCollection);
  app.save(playersCollection);

  const configCollection = app.findCollectionByNameOrId("pbc_tourn_config_12345");
  unmarshal({
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
  }, configCollection);
  app.save(configCollection);
})
