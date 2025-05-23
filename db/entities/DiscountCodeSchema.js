const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "DiscountCodes",
    tableName: "discountCodes",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
        },
        code: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        description: {
            type: "text",
            nullable: true,
        },
        discount_type: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        discount_value: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        min_purchase: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: true,
            default: 0,
        },
        start_date: {
            type: "timestamp",
            nullable: false,
        },
        end_date: {
            type: "timestamp",
            nullable: false,
        },
        usage_limit: {
            type: "integer",
            nullable: true
        },
        used_count: {
            type: "integer",
            nullable: true,
            default: 0,
        },
        is_active: {
            type: "boolean",
            nullable: false,
            default: true,
        },
        created_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
        created_by: {
            type: "uuid",
            nullable: false
        }
    },
    relations:{
        User: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "created_by",
                referencedColumnName: "id",
                foreignKeyConstraintName: "discount_code_created_by_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})