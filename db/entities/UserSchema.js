const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "User",
  tableName: "users",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    name: {
      type: "varchar",
      length: 50,
      nullable: true,
    },
    gender: {
      type: "varchar",
      length: 10,
      nullable: true,
    },
    email: {
      type: "varchar",
      length: 255,
      nullable: false,
      unique: true,
    },
    password: {
      type: "varchar",
      length: 255,
      nullable: false,
      select: false,
    },
    phone: {
      type: "varchar",
      length: 10,
      nullable: true,
    },
    birth_date: {
      type: "date",
      nullable: true,
    },
    address: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    role: {
      type: "varchar",
      length: 10,
      nullable: false,
      default: "customer",
    },
    avatar: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    is_active: {
      type: "boolean",
      default: true,
      nullable: false,
    },
    is_admin: {
      type: "boolean",
      default: false,
      nullable: false,
    },
    code: {
      type: "varchar",
      length: 6,
      nullable: true,
    },
    code_time: {
      type: "timestamp",
      nullable: true,
    },
    new_email: {
      type: "varchar",
      length: 255,
      nullable: true,
      unique: true
    },
    new_email_code: {
      type: "varchar",
      length: 6,
      nullable: true
    },
    new_email_code_time:{
      type: "timestamp",
      nullable: true,
    },
    created_at: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
    updated_at: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
      onUpdate: "CURRENT_TIMESTAMP",
    },
  },
});
