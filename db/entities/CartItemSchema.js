const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CartItem",
    tableName: "CART_ITEM",
    columns:{
        id:{
            primary: true,
            type: "integer",
            generated: "increment",
        },
        session_id:{ // 這是要做什麼用？
            type: "varchar",
            length: 100,
            nullable: false,
        },
        quantity:{
            type: "integer",
            length: 50,
            default: 1,
            nullable: false,
        },
        price: {
            type: "numeric",
            precision: 10,
            scale: 2,
            nullable: false,
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
        relations:{ //不懂是不是這樣寫
            user_id: { 
                type: "many-to-one",
                target: "User",
                joinColumn: true 
            },
            product_id: { 
                type: "many-to-one", 
                target: "Products", 
                joinColumn: true 
            },
        }
    }
})