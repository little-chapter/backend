const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Orders",
    tableName: "orders",
    columns: {
        id: {
            type: "uuid",
            primary: true,
            generated: "uuid",
            nullable: false,
        },
        user_id: {
            type: "uuid",
            nullable: false,
        },
        order_number: {
            type: "varchar",
            length: 30,
            nullable: false,
        },
        order_status: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        total_amount: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        shipping_fee: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
            default: 0,
        },
        discount_amount: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
            default: 0,
        },
        final_amount: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        recipient_name: {
            type: "varchar",
            length: 100,
            nullable: false,
        },
        recipient_email: {
            type: "varchar",
            length: 255,
            nullable: false,
        },
        recipient_phone: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        invoice_type: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        shipping_status: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        shipping_method: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        shipping_address: {
            type: "text",
            nullable: true,
        },
        store_code: {
            type: "varchar",
            length: 20,
            nullable: true,
        },
        store_name: {
            type: "varchar",
            length: 100,
            nullable: true,
        },
        payment_method:{
            type: "varchar",
            length: 50,
            nullable: true,
        },
        payment_status:{
            type: "varchar",
            length: 20,
            nullable: true,
        },
        note:{
            type: "text",
            nullable: true,
        },
        status_note:{
            type: "text",
            nullable: true,
        },
        shipped_at: {
            type: "timestamp",
            nullable: true,
        },
        completed_at: {
            type: "timestamp",
            nullable: true,
        },
        cancelled_at: {
            type: "timestamp",
            nullable: true,
        },
        created_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
        updated_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            nullable: false,
        },
    },
    relations: {
        User: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "user_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "orders_user_id_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})