const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "RecommendationSections",
    tableName: "recommendationSections",
    columns:{
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false
        },
        name: {
            type: "varchar",
            length: 100,
            nullable: false
        },
        description: {
            type: "text",
            nullable: true,
        },
        created_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false
        },
        updated_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            nullable: false,
        },
    },
})