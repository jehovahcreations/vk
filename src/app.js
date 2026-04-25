const express = require("express");
const path = require("path");
const csrf = require("csurf");
const env = require("./config/env");
const sessionMiddleware = require("./config/session");
const pool = require("./config/db");
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

app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/shipping", (req, res) => res.render("shipping"));
app.get("/refund", (req, res) => res.render("refund"));

app.get("/", async (req, res, next) => {
  if (req.session?.user?.role === "admin") {
    return res.redirect("/admin/dashboard");
  }
  if (req.session?.user?.role === "student") {
    return res.redirect("/student/dashboard");
  }

  try {
    const [catalogRes, learnerRes, commissionRes, weeklyCommissionRes, paymentStatusRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::INTEGER AS total_courses
         FROM products
         WHERE is_active = true
           AND type = 'video'`
      ),
      pool.query(
        `SELECT COUNT(*)::INTEGER AS total_learners
         FROM users
         WHERE role = 'student'
           AND is_active = true`
      ),
      pool.query(
        `SELECT COALESCE(SUM(commission_amount_in_paise), 0)::BIGINT AS total_affiliate_earnings_in_paise
         FROM referral_commissions`
      ).catch((error) => {
        if (error.code === "42P01") {
          return { rows: [{ total_affiliate_earnings_in_paise: 0 }] };
        }
        throw error;
      }),
      pool.query(
        `SELECT COALESCE(SUM(commission_amount_in_paise), 0)::BIGINT AS weekly_payout_in_paise
         FROM referral_commissions
         WHERE created_at >= NOW() - INTERVAL '7 days'
           AND status = 'credited'`
      ).catch((error) => {
        if (error.code === "42P01") {
          return { rows: [{ weekly_payout_in_paise: 0 }] };
        }
        throw error;
      }),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'captured')::INTEGER AS captured,
           COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed,
           COUNT(*) FILTER (WHERE status IN ('created', 'authorized'))::INTEGER AS pending
         FROM payments`
      )
    ]);

    const paymentCounts = paymentStatusRes.rows[0] || {};
    const capturedPayments = Number(paymentCounts.captured || 0);
    const failedPayments = Number(paymentCounts.failed || 0);
    const pendingPayments = Number(paymentCounts.pending || 0);
    const knownPaymentCount = capturedPayments + failedPayments + pendingPayments;
    const paymentSuccessRate = knownPaymentCount > 0
      ? (capturedPayments / knownPaymentCount) * 100
      : 0;

    return res.render("index", {
      homepageStats: {
        totalCourses: Number(catalogRes.rows[0]?.total_courses || 0),
        totalLearners: Number(learnerRes.rows[0]?.total_learners || 0),
        totalAffiliateEarningsInPaise: Number(commissionRes.rows[0]?.total_affiliate_earnings_in_paise || 0),
        weeklyPayoutInPaise: Number(weeklyCommissionRes.rows[0]?.weekly_payout_in_paise || 0),
        paymentSuccessRate,
        capturedPayments
      }
    });
  } catch (error) {
    return next(error);
  }
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
