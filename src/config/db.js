const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  user: env.dbUser || "postgres",
  host: env.dbHost || "localhost",
  database: env.dbName || "vk_training",
  password: String(env.dbPassword || "Jesmysav!234567890"),
  port: Number(env.dbPort || 5432)
});

module.exports = pool;
