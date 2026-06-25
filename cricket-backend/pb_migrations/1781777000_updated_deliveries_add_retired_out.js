/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2444735992")
  const field = collection.fields.getByName("dismissal_type")
  if (field) {
    field.values = [
      "None",
      "Bawled",
      "Catch",
      "Run Out",
      "Stumped",
      "Hit Wicket",
      "Retired Out"
    ]
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2444735992")
  const field = collection.fields.getByName("dismissal_type")
  if (field) {
    field.values = [
      "None",
      "Bawled",
      "Catch",
      "Run Out",
      "Stumped",
      "Hit Wicket"
    ]
  }
  return app.save(collection)
})
