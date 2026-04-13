const webhookRepository = require("../repositories/webhook.repository");
const paymentRepository = require("../repositories/payment.repository");
const purchaseRepository = require("../repositories/purchase.repository");
const { isAlreadyProcessed } = require("../utils/idempotency");

async function processEvent({ event, signature }) {
  const eventId = event.id || null;
  let webhookEvent = null;
  if (eventId) {
    const existing = await webhookRepository.findByEventId(eventId);
    if (isAlreadyProcessed(existing)) {
      return existing;
    }
    if (existing) {
      webhookEvent = existing;
    }
  }

  if (!webhookEvent) {
    webhookEvent = await webhookRepository.createWebhookEvent({
      eventId,
      eventType: event.event,
      signature,
      payload: event
    });
  }

  try {
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;

    if (event.event === "payment.captured" && orderId) {
      const order = await purchaseRepository.findByRazorpayOrderId(orderId);
      if (order) {
        let payment = await paymentRepository.findByRazorpayPaymentId(paymentId);
        if (!payment) {
          payment = await paymentRepository.createPayment({
            purchaseOrderId: order.id,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            amountInPaise: order.amount_in_paise,
            currency: order.currency,
            status: "captured",
            paymentMethod: paymentEntity?.method,
            razorpaySignature: null,
            rawCallbackPayload: null,
            rawWebhookPayload: event,
            verifiedAt: new Date()
          });
        } else {
          await paymentRepository.updatePaymentStatus({
            id: payment.id,
            status: "captured",
            verifiedAt: new Date(),
            rawWebhookPayload: event,
            failureReason: null
          });
        }
        await purchaseRepository.updateOrderStatus(order.id, "paid");
        await purchaseRepository.createUserPurchase({
          userId: order.user_id,
          productId: order.product_id,
          purchaseOrderId: order.id,
          paymentId: payment.id
        });
      }
    }

    if (event.event === "payment.failed" && orderId) {
      const order = await purchaseRepository.findByRazorpayOrderId(orderId);
      if (order) {
        await purchaseRepository.updateOrderStatus(order.id, "failed");
        if (paymentId) {
          const payment = await paymentRepository.findByRazorpayPaymentId(paymentId);
          if (payment) {
            await paymentRepository.updatePaymentStatus({
              id: payment.id,
              status: "failed",
              verifiedAt: null,
              rawWebhookPayload: event,
              failureReason: "payment_failed"
            });
          }
        }
      }
    }

    if (event.event === "order.paid" && orderId) {
      const order = await purchaseRepository.findByRazorpayOrderId(orderId);
      if (order) {
        await purchaseRepository.updateOrderStatus(order.id, "paid");
      }
    }

    await webhookRepository.markProcessed(webhookEvent.id, null);
    return webhookEvent;
  } catch (error) {
    await webhookRepository.markProcessed(webhookEvent.id, error.message);
    throw error;
  }
}

async function listWebhooks() {
  return webhookRepository.listWebhooks();
}

module.exports = {
  processEvent,
  listWebhooks
};
