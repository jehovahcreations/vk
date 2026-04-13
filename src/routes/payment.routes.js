const express = require("express");
const requireStudent = require("../middlewares/requireStudent");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

router.get("/products/:slug/checkout", requireStudent, paymentController.renderCheckout);
router.post("/payments/create-order", requireStudent, paymentController.createOrder);
router.post("/payments/verify", requireStudent, paymentController.verifyPayment);
router.get("/payments/success", requireStudent, paymentController.renderSuccess);
router.get("/payments/failed", requireStudent, paymentController.renderFailed);
router.get("/purchases", requireStudent, paymentController.renderPurchases);

module.exports = router;
