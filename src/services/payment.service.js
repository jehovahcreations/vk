const pool = require("../config/db");
const paymentRepository = require("../repositories/payment.repository");
const purchaseRepository = require("../repositories/purchase.repository");
const { createUserPurchase } = require("../repositories/purchase.repository");
const commissionService = require("./commission.service");
const razorpayService = require("./razorpay.service");
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
    const existing = await paymentRepository.findByRazorpayPaymentIdForUpdate(paymentId, client);
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
        verifiedAt: new Date(),
        client
      });
    } else {
      payment = await paymentRepository.updatePaymentStatus({
        id: payment.id,
        status: "captured",
        verifiedAt: new Date(),
        rawWebhookPayload: null,
        failureReason: null,
        client
      });
    }

    const paidOrder = await purchaseRepository.updateOrderStatus(order.id, "paid", client);
    if (!paidOrder) {
      throw new Error("Unable to mark purchase order as paid.");
    }

    await createUserPurchase({
      userId: order.user_id,
      productId: order.product_id,
      purchaseOrderId: order.id,
      paymentId: payment.id,
      client
    });

    await client.query("COMMIT");

    await commissionService.creditReferralCommission({
      purchaseOrderId: order.id,
      paymentId: payment.id
    }).catch((error) => {
      console.error("Commission credit failed after payment access grant:", {
        message: error.message,
        purchaseOrderId: order.id,
        paymentId: payment.id
      });
    });

    return { payment, order };
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

async function reconcileCapturedPaymentForProduct({ userId, productId }) {
  const order = await purchaseRepository.findLatestOrderForUserProductWithRazorpay({
    userId,
    productId
  });

  return reconcileCapturedPaymentForOrder(order);
}

async function reconcileCapturedPaymentForOrder(order) {
  if (!order?.razorpay_order_id) {
    return false;
  }

  const payments = await razorpayService.fetchOrderPayments(order.razorpay_order_id);
  const capturedPayment = (payments?.items || []).find((payment) => payment.status === "captured");
  if (!capturedPayment) {
    return false;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let payment = await paymentRepository.findByRazorpayPaymentIdForUpdate(capturedPayment.id, client);
    if (!payment) {
      payment = await paymentRepository.createPayment({
        purchaseOrderId: order.id,
        razorpayOrderId: order.razorpay_order_id,
        razorpayPaymentId: capturedPayment.id,
        amountInPaise: order.amount_in_paise,
        currency: order.currency,
        status: "captured",
        paymentMethod: capturedPayment.method || null,
        razorpaySignature: null,
        rawCallbackPayload: null,
        rawWebhookPayload: {
          source: "razorpay_order_payment_reconciliation",
          payment: capturedPayment
        },
        verifiedAt: new Date(),
        client
      });
    } else if (payment.status !== "captured") {
      payment = await paymentRepository.updatePaymentStatus({
        id: payment.id,
        status: "captured",
        verifiedAt: new Date(),
        rawWebhookPayload: {
          source: "razorpay_order_payment_reconciliation",
          payment: capturedPayment
        },
        failureReason: null,
        client
      });
    }

    const paidOrder = await purchaseRepository.updateOrderStatus(order.id, "paid", client);
    if (!paidOrder) {
      throw new Error("Unable to mark purchase order as paid.");
    }

    await createUserPurchase({
      userId: order.user_id,
      productId: order.product_id,
      purchaseOrderId: order.id,
      paymentId: payment.id,
      client
    });

    await client.query("COMMIT");

    await commissionService.creditReferralCommission({
      purchaseOrderId: order.id,
      paymentId: payment.id
    }).catch((error) => {
      console.error("Commission credit failed after payment reconciliation:", {
        message: error.message,
        purchaseOrderId: order.id,
        paymentId: payment.id
      });
    });

    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reconcileRecentCapturedVideoPaymentsForUser(userId) {
  const orders = await purchaseRepository.listRecentUnpaidVideoOrdersForUser(userId);
  let repairedCount = 0;

  for (const order of orders) {
    if (await reconcileCapturedPaymentForOrder(order)) {
      repairedCount += 1;
    }
  }

  return repairedCount;
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
  reconcileCapturedPaymentForProduct,
  reconcileRecentCapturedVideoPaymentsForUser,
  listPayments,
  getPaymentDetail
};
