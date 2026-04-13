const express = require("express");
const path = require("path");
const csrf = require("csurf");
const env = require("./config/env");
const sessionMiddleware = require("./config/session");
const { consumeFlash, addFlash } = require("./utils/flashMessages");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const studentRoutes = require("./routes/student.routes");
const paymentRoutes = require("./routes/payment.routes");
const adminPaymentRoutes = require("./routes/admin.payment.routes");
const webhookRoutes = require("./routes/webhook.routes");
const videoCatalogRoutes = require("./routes/videoCatalog.routes");

const app = express();

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views"),
  path.join(__dirname, "..", "views")
]);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/webhooks", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks")) {
    return next();
  }
  return express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: false }));

app.use(sessionMiddleware);

app.use("/webhooks", webhookRoutes);

app.use(csrf());

app.use((req, res, next) => {
  res.locals.isAuthenticated = Boolean(req.session?.user);
  res.locals.currentUser = req.session?.user || null;
  res.locals.isAdmin = req.session?.user?.role === "admin";
  res.locals.isStudent = req.session?.user?.role === "student";
  res.locals.isReseller = Boolean(req.session?.user?.is_reseller);
  res.locals.flashMessages = consumeFlash(req);
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : "";
  next();
});

app.use(authRoutes);
app.use(videoCatalogRoutes);
app.use("/admin", adminRoutes);
app.use("/admin", adminPaymentRoutes);
app.use("/student", studentRoutes);
app.use("/student", paymentRoutes);

app.get("/auth", (req, res) => res.redirect("/login"));

app.get("/", (req, res) => {
  if (req.session?.user?.role === "admin") {
    return res.redirect("/admin/dashboard");
  }
  if (req.session?.user?.role === "student") {
    return res.redirect("/student/dashboard");
  }
  return res.render("index");
});

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    addFlash(req, "error", "Form has expired. Please try again.");
    return res.redirect("/login");
  }
  return next(err);
});

app.listen(env.port, () => {
  console.log(`Server running on ${env.appUrl}`);
});
