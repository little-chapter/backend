const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Categories",
    tableName: "categories",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
        },
        name: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        description: {
            type: "text",
            nullable: true,
        },
        display_order: {
            type: "integer",
            nullable: false,
            default: 1,
        },
        is_visible: {
            type: "boolean",
            nullable: false,
            default: true,
        }
    }
})