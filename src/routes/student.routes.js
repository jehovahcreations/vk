const express = require("express");
const requireStudent = require("../middlewares/requireStudent");
const studentController = require("../controllers/student.controller");

const router = express.Router();

router.get("/dashboard", requireStudent, studentController.renderDashboard);
router.get("/categories", requireStudent, studentController.renderCategories);
router.get("/affiliate", requireStudent, studentController.renderAffiliate);
router.post("/affiliate/links", requireStudent, studentController.handleCreateAffiliateLink);
router.post("/affiliate/links/:id/toggle", requireStudent, studentController.handleToggleAffiliateLink);
router.get("/earnings", requireStudent, studentController.renderEarnings);
router.get("/profile", requireStudent, studentController.renderProfile);

module.exports = router;
