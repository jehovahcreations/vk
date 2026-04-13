const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const env = require("./env");
const pool = require("./db");

const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: "session"
  }),
  name: "vk.sid",
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
});

module.exports = sessionMiddleware;
