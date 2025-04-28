const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "ProductImages",
    tableName: "productImages",
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
        image_url: {
            type: "varchar",
            length: 255,
            nullable: false,
        },
        is_primary: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        display_order: {
            type: "integer",
            nullable: false,
            default: 1,
        },
    },
    relations: {
        Products: {
            target: 'Products',
            type: 'one-to-many',
            joinColumn: {
                name: 'product_id',
                referencedColumnName: 'id',
                foreignKeyConstraintName: 'product_images_products_id_fk'
            },
            onDelete:'RESTRICT'
        },
    }
})