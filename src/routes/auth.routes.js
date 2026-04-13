const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const requireGuest = require("../middlewares/requireGuest");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 1000 * 60 * 10,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const resetLimiter = rateLimit({
  windowMs: 1000 * 60 * 10,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

router.get("/login", requireGuest, authController.renderLogin);
router.post("/login", requireGuest, loginLimiter, authController.handleLogin);

router.get("/register", requireGuest, authController.renderRegister);
router.post("/register", requireGuest, authController.handleRegister);

router.post("/logout", authController.handleLogout);

router.get("/forgot-password", requireGuest, authController.renderForgotPassword);
router.post("/forgot-password", requireGuest, resetLimiter, authController.handleForgotPassword);

router.get("/reset-password/:token", requireGuest, authController.renderResetPassword);
router.post("/reset-password/:token", requireGuest, resetLimiter, authController.handleResetPassword);

router.get("/access-denied", authController.renderAccessDenied);

module.exports = router;
