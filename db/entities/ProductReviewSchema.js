const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "ProductReviews",
    tableName: "productReviews",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        product_id: {
            type: "integer",
            nullable: false,
        },
        user_id: {
            type: "uuid",
            nullable: false,
        },
        order_item_id: {
            type: "integer",
            nullable: false,
        },
        rating: {
            type: "integer",
            nullable: false,
        },
        title: {
            type: "varchar",
            length: 10,
            nullable: false,
        },
        content: {
            type: "varchar",
            length: 100,
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
        is_visible: {
            type: "boolean",
            nullable: false,
            default: true,
        },
    },
    relations: {
        User: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "user_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "product_reviews_user_id_fk"
            },
            onDelete:"RESTRICT"
        },
        OrderItems: {
            target: "OrderItems",
            type: "one-to-one",
            joinColumn: {
                name: "order_item_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "product_reviews_order_item_id_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})