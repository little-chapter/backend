const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Notifications",
    tableName: "notifications",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
        },
        user_id: {
            type: "uuid",
            nullable: false,
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
        is_read: {
            type: "boolean",
            default: false,
            nullable: false
        },
        is_deleted: {
            type: "boolean",
            default: false,
            nullable: false
        },
        template_id: {
            type: "integer",
            nullable: true,
        },
        created_by_admin: {
            type: "boolean",
            default: false,
            nullable: false
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
                name: "user_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "notifications_user_id_fk"
            },
            onDelete:"RESTRICT"
        },
        NotificationTemplates: {
            target: "NotificationTemplates",
            type: "many-to-one",
            joinColumn: {
                name: "template_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "notifications_template_id_fk"
            },
            onDelete:"RESTRICT"
        }
    }
});