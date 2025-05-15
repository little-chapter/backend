const express = require("express");
const cors = require("cors");
const path = require("path");
const pinoHttp = require("pino-http");

const logger = require("./utils/logger")("App");
const usersRouter = require("./routes/users");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const homepageRouter = require("./routes/homepage");
const adminRouter = require("./routes/admin");
const checkoutRouter = require("./routes/checkout");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        req.body = req.raw.body;
        return req;
      },
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthcheck", (req, res) => {
  res.status(200);
  res.send("OK");
});
app.use("/api/users", usersRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/homepage", homepageRouter);
app.use("/api/admin", adminRouter);
app.use("/api/checkout", checkoutRouter);

app.use((req, res, next) => {
  res.status(404).json({
    status: false,
    message: "無此路由",
  });
  return;
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.log.error(err);
  res.status(500).json({
    status: false,
    message: "伺服器錯誤，請稍後再試",
  });
});

module.exports = app;
