const crypto = require("crypto");

function verifyWebhookSignature({ payload, signature, secret }) {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!signature || expected.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
  verifyWebhookSignature
};
