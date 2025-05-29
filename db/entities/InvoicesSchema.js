const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Invoices",
    tableName: "invoices",
    columns: {
        id: {
            type: "integer",
            primary: true,
            generated: "increment",
            nullable: false,
        },
        order_id:{
            type: "uuid",
            nullable: true,
            unique: true
        },
        merchant_order_no: {
            type: "varchar",
            length: 30,
            nullable: false,
            unique: true
        },
        invoice_number: {
            type: "varchar",
            length: 10,
            nullable: false,
            unique: true
        },
        total_amount:{
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
        },
        invoice_trans_no: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        random_number: {
            type: "varchar",
            length: 4,
            nullable: false,
        },
        barcode: {
            type: "varchar",
            length: 19,
            nullable: true,
        },
        qrcode_l: {
            type: "varchar",
            length: 140,
            nullable: true,
        },
        qrcode_r: {
            type: "varchar",
            length: 140,
            nullable: true,
        },
        check_code: {
            type: "varchar",
            length: 64,
            nullable: false,
        },
        status: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        failed_message: {
            type: "varchar",
            length: 100,
            nullable: true,
        },
        create_time: {
            type: "timestamptz",
            nullable: false,
        }
    },
    relations: {
        Orders: {
            target: "Orders",
            type: "one-to-one",
            joinColumn: {
                name: "order_id",
                referencedColumnName: "id",
                foreignKeyConstraintName: "invoices_order_id_fk"
            },
            onDelete:"RESTRICT"
        },
    }
})