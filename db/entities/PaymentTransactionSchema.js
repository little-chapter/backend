const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PaymentTransactions",
    tableName: "paymentTransactions",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        order_id: {
            type: "uuid",
            nullable: false,
        },
        merchant_order_no: {
            type: "varchar",
            length: 30,
            nullable: false,
            unique: true
        },
        transaction_number: {
            type: "varchar",
            length: 100,
            nullable: false,
        },
        payment_type: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        amount: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        currency: {
            type: "varchar",
            length: 10,
            nullable: false,
            default: "TWD",
        },
        status: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        payment_time: {
            type: "timestamp",
            nullable: false,
        },
        bank_code: {
            type: "varchar",
            length: 10,
            nullable: true,
        },
        payer_account5code: {
            type: "varchar",
            length: 10,
            nullable: true,
        },
        account_number: {
            type: "varchar",
            length: 50,
            nullable: true,
        },
        barcode_1: {
            type: "varchar",
            length: 50,
            nullable: true,
        },
        barcode_2: {
            type: "varchar",
            length: 50,
            nullable: true,
        },
        barcode_3: {
            type: "varchar",
            length: 50,
            nullable: true,
        },
        auth_code: {
            type: "varchar",
            length: 20,
            nullable: true,
        },
        card_start6: {
            type: "varchar",
            length: 6,
            nullable: true,
        },
        card_last4: {
            type: "varchar",
            length: 4,
            nullable: true,
        },
        return_code: {
            type: "varchar",
            length: 20,
            nullable: true,
        },
        return_message: {
            type: "text",
            nullable: true,
        },
        raw_response: {
            type: "text",
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
        Orders: {
            target: "Orders",
            type: "one-to-one",
            joinColumn: {
                name: "order_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "paymentTransactions_orders_id_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})