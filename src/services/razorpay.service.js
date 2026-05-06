const { getRazorpayClient } = require("../config/razorpay");

async function createOrder({ amountInPaise, currency, receipt, notes }) {
  const client = await getRazorpayClient();
  return client.orders.create({
    amount: amountInPaise,
    currency,
    receipt,
    notes
  });
}

async function fetchOrderPayments(orderId) {
  const client = await getRazorpayClient();
  return client.orders.fetchPayments(orderId);
}

module.exports = {
  createOrder,
  fetchOrderPayments
};
