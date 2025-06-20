const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "RecommendationProducts",
    tableName: "recommendationProducts",
    columns:{
        section_id: {
            type: "integer",
            primary: true,
            nullable: false,
        },
        product_id: {
            type: "integer",
            primary: true,
            nullable: false,
        },
        display_order: {
            type: "integer",
            nullable: false,
            default: 1,
        },
        is_active: {
            type: "boolean",
            nullable: false,
            default: true
        },
        is_manual: {
            type: "boolean",
            nullable: false,
            default: false
        },
        created_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false
        },
    },
    relations: {
        RecommendationSections: {
            target: "RecommendationSections",
            type: "many-to-one",
            joinColumn: {
                name: "section_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "recommendation_products_section_id_fk"
            },
            onDelete:"RESTRICT"
        },
        Products: {
            target: "Products",
            type: "many-to-one",
            joinColumn: {
                name: "product_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "recommendation_products_product_id_fk"
            },
            onDelete:"RESTRICT"
        },
    },
    indices: [
        {
            name: "PK_section_product",
            unique: true,
            columns: ["section_id", "product_id"]
        }
    ]
})