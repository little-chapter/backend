const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "ProductLinkCategory",
    tableName: "productLinkCategory",
    columns: {
        product_id:{
            type: "integer",
            primary: true,
            nullable: false,
        },
        category_id:{
            type: "integer",
            primary: true,
            nullable: false,
        }
    },
    relations: {
        Products: {
            target: 'Products',
            type: 'one-to-many',
            joinColumn: {
                name: 'product_id',
                referencedColumnName: 'id',
                foreignKeyConstraintName: 'product_link_category_product_id_fk'
            },
            onDelete:'RESTRICT'
        },
        Categories: {
            target: 'Categories',
            type: 'one-to-many',
            joinColumn: {
                name: 'category_id',
                referencedColumnName: 'id',
                foreignKeyConstraintName: 'product_link_category_category_id_fk'
            },
            onDelete:'RESTRICT'
        },
    },
    indices: [
        {
            name: 'PK_product_category',
            unique: true,
            columns: ['product_id', 'category_id']
        }
    ],
})