const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Tasks",
    tableName:  "tasks",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        title: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        content: {
            type: "text",
            nullable: true,
        },
        type: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        related_resource_type: {
            type: "varchar",
            length: 50,
            nullable: true,
        },
        related_resource_id: {
            type: "text",
            nullable: true,
        },
        priority: {
            type: "integer",
            nullable: false,
            default: 3
        },
        status: {
            type: "varchar",
            length: 50,
            default: "pending"
        },
        assigned_to: {
            type: "uuid",
            nullable: true
        },
        completed_by: {
            type: "uuid",
            nullable: true
        },
        completed_at: {
            type: "timestamptz",
            nullable: true,
        },
        canceled_by: {
            type: "uuid",
            nullable: true
        },
        canceled_at: {
            type: "timestamptz",
            nullable: true,
        },
        updated_at:{
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            nullable: false,
        },
        created_by: {
            type: "uuid",
            nullable: true
        },
        created_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        }
    },
    relations: {
        createdBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: {
                name: "created_by",
            },
            nullable: true,
        },
        assignedTo: {
            type: "many-to-one",
            target: "User",
            joinColumn: {
                name: "assigned_to",
            },
            nullable: true,
        },
        completedBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: {
                name: "completed_by",
            },
            nullable: true,
        },
        canceledBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: {
                name: "canceled_by",
            },
            nullable: true,
        },
    }
})