const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Products",
    tableName: "products",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        title: {
            type: "varchar",
            length: 255,
            nullable: false,
        },
        author: {
            type: "varchar",
            length: 100,
            nullable: true,
        },
        illustrator: {
            type: "varchar",
            length: 100,
            nullable: true,
        },
        publisher: {
            type: "varchar",
            length: 100,
            nullable: true,
        },
        isbn: {
            type: "varchar",
            length: 20,
            nullable: true,
            unique: true
        },
        description: {
            type: "text",
            nullable: true,
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
        stock_quantity: {
            type: "integer",
            nullable: false,
            default: 0,
        },
        page_count: {
            type: "integer",
            nullable: true,
        },
        publish_date: {
            type: "date",
            nullable: true,
        },
        age_range_id: {
            type: "integer",
            nullable: false,
        },
        category_id: {
            type: "integer",
            nullable: false,
        },
        introduction_html: {
            type: "text",
            nullable: true,
        },
        is_new_arrival: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        is_bestseller: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        is_discount: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        is_visible:{
            type: "boolean",
            nullable: false,
            default: true,
        },
        is_bundle:{
            type: "boolean",
            nullable: false,
            default: false,
        },
        created_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
        updated_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            nullable: false,
        }
    },
    relations: {
        AgeRanges: {
            target: "AgeRanges",
            type: "many-to-one",
            joinColumn: {
                name: "age_range_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "products_age_ranges_id_fk"
            },
            onDelete:"RESTRICT"
        },
        Categories: {
            target: "Categories",
            type: "many-to-one",
            joinColumn: {
                name: "category_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "products_categories_id_fk"
            },
            onDelete:"RESTRICT"
        }
    }
})