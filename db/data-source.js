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
const PaymentTransaction = require("./entities/PaymentTransactionSchema");
const CartItems = require("./entities/CartItemSchema");
const DiscountCode = require("./entities/DiscountCodeSchema");
const DiscountCodeUsage = require("./entities/DiscountCodeUsageSchema");
const PendingOrder = require("./entities/PendingOrderSchema");
const PendingOrderItem = require("./entities/PendingOrderItemSchema");
const Notifications = require("./entities/NotificationsSchema");
const Invoices = require("./entities/InvoicesSchema");
const Wishlists = require("./entities/WishlistsSchema");
const Tasks = require("./entities/TasksSchema");
const NotificationTemplates = require("./entities/NotificationTemplatesSchema");
const TemplateTargetUsers = require("./entities/TemplateTargetUsersSchema");

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
    PaymentTransaction,
    CartItems,
    DiscountCode,
    DiscountCodeUsage,
    PendingOrder,
    PendingOrderItem,
    Notifications,
    Invoices,
    Wishlists,
    Tasks,
    NotificationTemplates,
    TemplateTargetUsers,
  ],
  ssl: config.get("db.ssl"),
});

module.exports = { dataSource };
