const { Pool } = require("pg");
const env = require("./env");

if (!env.databaseUrl) {
  console.warn("DATABASE_URL is not set. Database operations will fail.");
}

const pool = new Pool({
  connectionString: env.databaseUrl
});

module.exports = pool;
