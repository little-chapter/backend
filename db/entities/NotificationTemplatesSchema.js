const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "NotificationTemplates",
    tableName: "notificationTemplates",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
        },
        title: {
            type: "varchar",
            length: 100,
            nullable: false,
        },
        content: {
            type: "text",
            nullable: false,
        },
        notification_type: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        link_url: {
            type: "varchar",
            length: 255,
            nullable: true,
        },
        is_broadcast: {
            type: "boolean",
            default: false,
            nullable: false
        },
        scheduled_at: {
            type: "timestamptz",
            nullable: true,
        },
        is_send: {
            type: "boolean",
            default: false,
            nullable: false
        },
        created_by_admin: {
            type: "boolean",
            default: true,
            nullable: false
        },
        created_by: {
            type: "uuid",
            nullable: false,
        },
        created_at: {
            type: "timestamptz",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        }
    },
    relations:{
        User: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "created_by",
                referencedColumnName: "id",
                foreignKeyConstraintName: "notification_templates_created_by_fk"
            },
            onDelete:"RESTRICT"
        }
    }
});