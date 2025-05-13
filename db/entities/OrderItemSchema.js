const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "OrderItems",
    tableName: "orderItems",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        order_id: {
            type: "uuid",
            nullable: false,
        },
        product_id: {
            type: "integer",
            nullable: false,
        },
        product_title: {
            type: "varchar",
            length: 255,
            nullable: false,
        },
        quantity: {
            type: "integer",
            nullable: false,
        },
        price: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        discount_price: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: true,
        },
        subtotal: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        is_reviewed: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        status_note: {
            type: "varchar",
            length: 255,
            nullable: true,
        },
    },
    relations: {
        Products: {
            target: "Products",
            type: "many-to-one",
            joinColumn: {
                name: "product_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "order_items_product_id_fk"
            },
            onDelete:"RESTRICT"
        },
        Orders: {
            target: "Orders",
            type: "many-to-one",
            joinColumn: {
                name: "order_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "order_items_order_id_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})