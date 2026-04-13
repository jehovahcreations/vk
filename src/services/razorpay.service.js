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

module.exports = {
  createOrder
};
