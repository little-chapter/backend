const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "TemplateTargetUsers",
    tableName: "templateTargetUsers",
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
        template_id: {
            type: "integer",
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
                name: "user_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "templateTargetUsers_user_id_fk"
            },
            onDelete:"RESTRICT"
        },
        NotificationTemplates: {
            target: "NotificationTemplates",
            type: "many-to-one",
            joinColumn: {
                name: "template_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "templateTargetUsers_template_id_fk"
            },
            onDelete:"RESTRICT"
        }
    }
});