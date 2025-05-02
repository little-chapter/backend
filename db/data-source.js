const { DataSource } = require("typeorm");
const config = require("../config/index");

const UserSchema = require("./entities/UserSchema");
const ProductsSchema = require("./entities/ProductsSchema");
const AgeRangeSchema = require("./entities/AgeRangeSchema");
const CategorySchema = require("./entities/CategorySchema");
const ProductImages = require("./entities/ProductImageSchema");
const ProductReview = require("./entities/ProductReviewSchema");
const OrderItem = require("./entities/OrderItemSchema");
const Order = require("./entities/OrderSchema");
const RecommendationProduct = require("./entities/RecommendationProductSchema");
const RecommendationSection = require("./entities/RecommendationSectionSchema");

const dataSource = new DataSource({
  type: "postgres",
  host: config.get("db.host"),
  port: config.get("db.port"),
  username: config.get("db.username"),
  password: config.get("db.password"),
  database: config.get("db.database"),
  synchronize: config.get("db.synchronize"),
  poolSize: 10,
  entities: [
    UserSchema,
    ProductsSchema,
    AgeRangeSchema,
    CategorySchema,
    ProductImages,
    ProductReview,
    OrderItem,
    Order,
    RecommendationProduct,
    RecommendationSection,
  ],
  ssl: config.get("db.ssl"),
});

module.exports = { dataSource };
