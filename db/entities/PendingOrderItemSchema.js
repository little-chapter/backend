const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PendingOrderItems",
    tableName: "pendingOrderItems",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        pending_order_id: {
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
        subtotal: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        expired_at: {
            type: "timestamptz",
            nullable: false,
        },
    },
    relations: {
        Products: {
            target: "Products",
            type: "many-to-one",
            joinColumn: {
                name: "product_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "pending_order_items_product_id_fk"
            },
        },
        PendingOrders: {
            target: "PendingOrders",
            type: "many-to-one",
            joinColumn: {
                name: "pending_order_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "pending_order_items_order_id_fk"
            },
            onDelete:"CASCADE"
        },
    }
})