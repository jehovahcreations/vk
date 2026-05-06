const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  databaseUrl:
    (process.env.DATABASE_URL || "").trim() ||
    "postgres://postgres:Jesmysav!234567890@localhost:5432/vk_training",
  dbHost: (process.env.DB_HOST || "localhost").trim(),
  dbPort: Number((process.env.DB_PORT || "5432").trim()) || 5432,
  dbName: (process.env.DB_NAME || "vk_training").trim(),
  dbUser: (process.env.DB_USER || "postgres").trim(),
  dbPassword: process.env.DB_PASSWORD || "Jesmysav!234567890",
  sessionSecret: process.env.SESSION_SECRET || "dev_session_secret",
  appUrl: process.env.APP_URL || "http://localhost:5000",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
};

module.exports = env;
