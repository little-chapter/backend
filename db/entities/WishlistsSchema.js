const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Wishlists",
  tableName: "wishlists",
  columns: {
    id: {
      primary: true,
      type: "integer",
      generated: true,
    },
    user_id: {
      type: "uuid",
      nullable: false
    },
    product_id: {
      type: "integer",
      nullable: false
    },
    added_at: {
      type: "timestamptz",
      createDate: true,
      nullable: false
    },
  },
  uniques: [
    {
      name: "wishlists_user_product_unique",
      columns: ["user_id", "product_id"]
    }
  ],
  relations: {
    Users: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "user_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "wishlists_user_id_fk"
      },
      onDelete:"CASCADE"
    },
    Products: {
      target: "Products",
      type: "many-to-one",
      joinColumn: {
        name: "product_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "wishlists_product_id_fk"        
      },
      onDelete:"CASCADE"
    }
  }
});