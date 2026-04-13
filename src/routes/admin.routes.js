const express = require("express");
const requireAdmin = require("../middlewares/requireAdmin");
const adminController = require("../controllers/admin.controller");
const categoryRoutes = require("./category.routes");
const adminStudentRoutes = require("./admin.students.routes");
const adminVideoRoutes = require("./admin.videos.routes");
const referralRoutes = require("./referral.routes");
const paymentSettingsRoutes = require("./paymentSettings.routes");

const router = express.Router();

router.get("/", requireAdmin, (req, res) => res.redirect("/admin/dashboard"));
router.get("/dashboard", requireAdmin, adminController.renderDashboard);
router.use("/videos", adminVideoRoutes);
router.use("/categories", categoryRoutes);
router.use("/students", adminStudentRoutes);
router.use("/referrals", referralRoutes);
router.use("/", paymentSettingsRoutes);

module.exports = router;
