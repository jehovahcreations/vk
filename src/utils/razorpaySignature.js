const crypto = require("crypto");

function verifyRazorpaySignature({ orderId, paymentId, signature, secret }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (!signature || expected.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
  verifyRazorpaySignature
};
