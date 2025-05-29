const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "DiscountCodeUsages",
    tableName: "discountCodeUsages",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
        },
        code_id: {
            type: "integer",
            nullable: false,
        },
        order_id: {
            type: "uuid",
            nullable: false,
        },
        user_id: {
            type: "uuid",
            nullable: false,
        },
        discount_amount: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        used_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        }
    },
    relations:{
        DiscountCodes: {
            target: "DiscountCodes",
            type: "many-to-one",
            joinColumn: {
                name: "code_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "discount_code_usage_code_id_fk"
            },
            onDelete:"RESTRICT"
        },
        Orders:{
            target: "Orders",
            type: "many-to-one",
            joinColumn: {
                name: "order_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "discount_code_usage_order_id_fk"
            },
            onDelete:"RESTRICT"
        },
        User: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "user_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "discount_code_usage_user_id_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})