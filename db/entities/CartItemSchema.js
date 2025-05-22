const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CartItems",
    tableName: "cart_items",
    columns:{
        id:{
            primary: true,
            type: "integer",
            generated: "increment",
        },
        user_id: {
            type: "uuid",
            nullable: false,
        },
        // session_id:{
        //     type: "varchar",
        //     length: 100,
        //     nullable: false,
        // },
        product_id:{
            type: "integer",
            nullable: false
        },
        quantity:{
            type: "integer",
            default: 1,
            nullable: false,
        },
        price: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        created_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
        updated_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            nullable: false,
        },
    },
    relations:{
        User: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "user_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "cart_items_user_id_fk"
            },
            onDelete:"RESTRICT"
        },
        Products: {
            target: "Products",
            type: "many-to-one",
            joinColumn: {
                name: "product_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "cart_items_product_id_fk"
            },
            onDelete:"CASCADE"
        },
    },
});