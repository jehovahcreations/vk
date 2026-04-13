const pool = require("../config/db");
const paymentRepository = require("../repositories/payment.repository");
const purchaseRepository = require("../repositories/purchase.repository");
const { createUserPurchase } = require("../repositories/purchase.repository");
const commissionService = require("./commission.service");
const { verifyRazorpaySignature } = require("../utils/razorpaySignature");

async function verifyPayment({ orderId, paymentId, signature, keySecret }) {
  const order = await purchaseRepository.findByRazorpayOrderId(orderId);
  if (!order) {
    const error = new Error("Order not found.");
    error.code = "ORDER_NOT_FOUND";
    throw error;
  }

  const isValid = verifyRazorpaySignature({
    orderId,
    paymentId,
    signature,
    secret: keySecret
  });

  if (!isValid) {
    const error = new Error("Payment signature verification failed.");
    error.code = "SIGNATURE_INVALID";
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await paymentRepository.findByRazorpayPaymentId(paymentId);
    let payment = existing;

    if (!payment) {
      payment = await paymentRepository.createPayment({
        purchaseOrderId: order.id,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amountInPaise: order.amount_in_paise,
        currency: order.currency,
        status: "captured",
        paymentMethod: null,
        razorpaySignature: signature,
        rawCallbackPayload: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        },
        rawWebhookPayload: null,
        verifiedAt: new Date()
      });
    } else {
      await paymentRepository.updatePaymentStatus({
        id: payment.id,
        status: "captured",
        verifiedAt: new Date(),
        rawWebhookPayload: null,
        failureReason: null
      });
    }

    await purchaseRepository.updateOrderStatus(order.id, "paid", client);

    await createUserPurchase({
      userId: order.user_id,
      productId: order.product_id,
      purchaseOrderId: order.id,
      paymentId: payment.id,
      client
    });

    await commissionService.creditReferralCommission({
      purchaseOrderId: order.id,
      paymentId: payment.id,
      client
    });

    await client.query("COMMIT");
    return payment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markPaymentFailed({ orderId, reason }) {
  const order = await purchaseRepository.findByRazorpayOrderId(orderId);
  if (!order) {
    return null;
  }
  await purchaseRepository.updateOrderStatus(order.id, "failed");
  const payment = await paymentRepository.findByOrderId(order.id);
  if (!payment) {
    return null;
  }
  return paymentRepository.updatePaymentStatus({
    id: payment.id,
    status: "failed",
    failureReason: reason
  });
}

async function listPayments() {
  return paymentRepository.listPayments();
}

async function getPaymentDetail(id) {
  return paymentRepository.findPaymentDetail(id);
}

module.exports = {
  verifyPayment,
  markPaymentFailed,
  listPayments,
  getPaymentDetail
};
